# backend/blueprints/auth.py
# 認証・アカウント関連エンドポイント（登録・ログイン・ログアウト・セッション・アカウント編集/削除）

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    unset_jwt_cookies,
)
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import limiter
from models import db, User, Shift, ShiftRejectionHistory

auth_bp = Blueprint("auth", __name__)

# 自己登録時に指定できるroleのホワイトリスト。
# 'admin'は「新規店舗のオーナーとして始める」ための唯一の導線であり意図的に許可しているが
# （/api/shop_registerはrole=adminかつshop_id未設定のユーザーのみ許可）、
# それ以外の任意文字列（将来 role!=shop_id チェックのみで権限判定する処理が増えた場合に危険）は拒否する。
ALLOWED_SELF_REGISTER_ROLES = {"staff", "admin"}


# -------------------- API: ユーザー登録 --------------------
@auth_bp.route("/api/register", methods=["POST"])
@limiter.limit("10 per minute")
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "staff") # 登録時には role は 'staff' などのデフォルト値が設定されることを想定

    if role not in ALLOWED_SELF_REGISTER_ROLES:
        return jsonify({"error": "roleの指定が不正です"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "そのメールアドレスは既に登録済みです"}), 400
    if not name or not email or not password:
        return jsonify({"error": "名前・メール・パスワードは必須やで！"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "そのメールアドレスは既に登録済みです"}), 400

    user = User(
        name=name,
        email=email,
        role=role,
        password=generate_password_hash(password)
    )
    db.session.add(user)
    db.session.commit() # ユーザーID (user.id) が確定する

    # ★★★ 登録成功後、JWTトークンを発行する ★★★

    # 1. アクセストークンを生成
    access_token = create_access_token(identity=str(user.id), fresh=True)

    # 2. レスポンスオブジェクトを作成
    response = jsonify({
        "message": "登録成功",
        # "access_token": access_token, # クッキーで渡すため、JSONからは削除してもOK
        "user": {
            "user_name": user.name,
            "role": user.role,
            "shop_name": None,
            "shop_id": None
        }
    })

    # 3. クッキーを設定してからリターンする
    set_access_cookies(response, access_token)

    # 4. レスポンスを返す
    return response, 201

# -------------------- API: アカウント情報編集 (JWT 対応) --------------------
@auth_bp.route("/api/account/edit", methods=["POST"])
@jwt_required() # JWTトークンが必須
def edit_account():
    # 1. ログインチェック (JWTからユーザーIDを取得)
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    data = request.json
    new_name = data.get("name")
    new_email = data.get("email")
    new_password = data.get("password") # パスワードは変更する場合のみ

    # ユーザーオブジェクトを取得
    user = db.session.get(User, user_id)
    # トークンが有効でもDBにユーザーがいなかった場合
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    # 2. 名前の更新
    if new_name:
        user.name = new_name

    # 3. メールの更新と重複チェック
    if new_email and new_email != user.email:
        # 他のユーザーが既にそのメールアドレスを使っていないかチェック (自分自身は除外)
        if User.query.filter(User.email == new_email, User.id != user_id).first():
            return jsonify({"error": "そのメールアドレスは既に使用されています"}), 400
        user.email = new_email

    # 4. パスワードの更新
    if new_password:
        # werkzeug.security の generate_password_hash を使用
        user.password = generate_password_hash(new_password)

    db.session.commit()

    # 5. 成功レスポンス
    return jsonify({"message": "アカウント情報を更新しました"}), 200


# -------------------- API: アカウント削除 (JWT 対応) --------------------
@auth_bp.route("/api/account/delete", methods=["POST"])
@jwt_required() # ★ JWTトークンが必須になる
def delete_account():
    # 1. ログインチェック (JWTからユーザーIDを取得)
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str) # トークンから user_id を取得

    # 2. ユーザーオブジェクトを取得
    user = db.session.get(User, user_id)
    # トークンが有効でもDBにユーザーがいなかった場合
    if not user:
        # ユーザーが見つからなくても、クライアントのクッキーを破棄して強制ログアウト
        response = jsonify({"error": "ユーザーが見つかりません。ログアウトします。"}), 404
        # タプルからレスポンスオブジェクトのみを取得して渡す
        unset_jwt_cookies(response[0])
        return response

    try:
        # 3. 関連データの削除
        # ユーザーに紐づく全ての Shift を削除
        Shift.query.filter_by(user_id=user.id).delete(synchronize_session='fetch')

        # ユーザーに紐づく棄却履歴を削除
        # （PostgreSQLは外部キー制約をデフォルトで強制するため、削除しないと
        #   db.session.delete(user)が制約違反で失敗しアカウント削除ができなくなる）
        ShiftRejectionHistory.query.filter_by(user_id=user.id).delete(synchronize_session='fetch')

        # 4. ユーザーアカウント本体の削除
        db.session.delete(user)

        # 5. セッション情報のクリア (JWTでは不要だが、念のためログイン/JWT情報削除)
        db.session.commit()

        # 6. 削除成功時、レスポンスオブジェクトを作成し、JWTクッキーを削除
        # jsonifyの結果 (レスポンスオブジェクト) を変数に代入
        response = jsonify({"message": "アカウントを正常に削除しました"})

        # response オブジェクトを unset_jwt_cookies に渡す
        unset_jwt_cookies(response)

        # 7. 最終的なレスポンスを返す (status code 200)
        return response, 200 # または return response
        # responseは既に200 OKのデフォルトステータスを持つため、return response で十分

    except Exception:
        db.session.rollback()
        return jsonify({"error": "アカウントの削除中にエラーが発生しました"}), 500

# -------------------- API: ログイン (JWT対応版) --------------------
@auth_bp.route("/api/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.json
    identifier = data.get("identifier")
    password = data.get("password")

    # 名前またはメールアドレスでユーザーを検索
    user = User.query.filter((User.name==identifier)|(User.email==identifier)).first()

    if user and check_password_hash(user.password, password):
        # ユーザーに紐づく店舗名を取得 (user.shopがNoneの場合を安全にチェック)
        shop_name_val = user.shop.name if user.shop else None

        # 1. アクセストークンを生成
        access_token = create_access_token(identity=str(user.id), fresh=True)

        # 3. レスポンスオブジェクトを作成
        response = jsonify({
            "message": "ログイン成功",
            "access_token": access_token, # モバイル/Webが保存するトークン
            "user": {
                "user_name": user.name,
                "role": user.role,
                "shop_name": shop_name_val,
                "shop_id": user.shop_id
            }
        })

        # 4. クッキーを設定してからリターンする
        set_access_cookies(response, access_token)

        # 5. レスポンスオブジェクトとステータスコードを返す
        return response, 200

    # 認証失敗
    return jsonify({"error": "ユーザー名かパスワードが違います"}), 401

# -------------------- API: ログアウト (JWT対応版) --------------------
@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    # 1. レスポンスオブジェクトを生成
    response = jsonify({"message": "ログアウト成功"})

    # 2. JWT クッキーを削除 (クライアントにトークン破棄を指示)
    # クッキーを使ってJWTをやり取りしている場合に必須
    unset_jwt_cookies(response)

    return response, 200 # 修正後のレスポンスを返す

# -------------------- API: セッション取得 (JWT対応版) --------------------
@auth_bp.route("/api/session")
@jwt_required(optional=True) # トークンがなくても関数が実行されるようにする
def get_session():
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    # 2. トークンが存在しない、または無効な場合は、未ログインとして処理
    if user_id_str is None:
        # 未ログインの場合は user: None を返し、200 OK でレスポンスを確定させる
        return jsonify({"user": None}), 200
    # 不正な形式のID（数値でない文字列など）のチェックを追加
    if not isinstance(user_id_str, str) or not user_id_str.isdigit():
        return jsonify({"user": None}), 200 # 無効なトークンとして扱う

    # 3. トークンが有効な場合の処理
    user_id = int(user_id_str)
    user_from_db = User.query.get(user_id)

    if user_from_db:
        # 最新のユーザー情報をDBから取得して返す
        return jsonify({
            "user": {
                "user_name": user_from_db.name,
                "role": user_from_db.role,
                "shop_name": user_from_db.shop.name if user_from_db.shop else None,
                "shop_id": user_from_db.shop_id,
                "shop_request_code": user_from_db.shop_request_code
            }
        }), 200 # 成功時は200を明示

    # トークンは有効だけどDBにユーザーがいなかった場合
    return jsonify({"user": None}), 200 # この場合も未ログインとして扱う
