# backend/blueprints/shops.py
# 店舗・参加リクエスト関連エンドポイント（店舗登録、参加リクエスト、店舗詳細、従業員一覧、ポジション更新）

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    set_refresh_cookies,
)
from sqlalchemy import update

from models import db, User, Shop, UserShop
from services.position import UNSPECIFIED_POSITION
from services.user_shops import ensure_user_shop_membership

shops_bp = Blueprint("shops", __name__)


# -------------------- API: 店舗登録 --------------------
@shops_bp.route("/api/shop_register", methods=["POST"])
@jwt_required(fresh=True) # (機密性の高い操作なので fresh=True を推奨)
def shop_register():
    # 1. ユーザー情報と権限チェック
    user_id_str = get_jwt_identity()
    manager_id = int(user_id_str)

    admin_user = db.session.get(User, manager_id)
    if not admin_user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    role = admin_user.role
    if role != "admin": # ロールチェックをトークンから
        return jsonify({"error": "管理者権限がありません"}), 403
    if admin_user.shop_id:
         return jsonify({"error": "既に店舗に所属しています"}), 400

    data = request.json
    name = data.get("name")
    location = data.get("location")

    if Shop.query.filter_by(name=name).first():
        return jsonify({"error": "店舗名が既に存在します"}), 400

    # 2. 店舗を登録（flushでshop.idだけ確定させ、まだコミットしない）
    code = Shop.generate_unique_code()
    shop = Shop(name=name, location=location, shop_code=code)
    db.session.add(shop)
    db.session.flush()

    # 3. 管理者ユーザーの情報を更新し、店舗作成とまとめて1トランザクションでコミットする
    #    （分けてcommitすると、後段で例外が起きた際に店舗だけ作成された不整合データが残るため）
    admin_user.shop_id = shop.id
    ensure_user_shop_membership(admin_user.id, shop.id)
    db.session.commit()

    # 4. DB更新後、クッキーにセットするアクセストークンを再発行する
    new_access_token = create_access_token(identity=str(admin_user.id), fresh=True)
    new_refresh_token = create_refresh_token(identity=str(admin_user.id))

    # 5. レスポンスオブジェクトの生成とクッキーへのセット
    response = jsonify({
        "message": "店舗登録成功",
        "shop_code": code,
        "shop_id": shop.id,
        # クライアント側の利便性のため、更新された情報を返す
        "user": {
            "user_name": admin_user.name,
            "role": admin_user.role,
            "shop_name": shop.name,
            "shop_id": shop.id
        }
    })

    set_access_cookies(response, new_access_token) # アクセストークンをクッキーにセット
    set_refresh_cookies(response, new_refresh_token) # リフレッシュトークンをクッキーにセット

    return response

# -------------------- API: 店舗参加リクエスト --------------------
@shops_bp.route('/api/join_shop/request', methods=['POST'])
@jwt_required()
def join_shop_request():
    data = request.get_json()
    shop_code = data.get('shop_code')

    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    # 2. ユーザーの取得
    user = db.session.get(User, user_id)
    if not user:
         return jsonify({"error": "ユーザーが見つかりません"}), 404

    # 3. 店舗コードの検証
    shop = Shop.query.filter_by(shop_code=shop_code).first()
    if not shop:
        return jsonify({"error": "無効な店舗コードです"}), 404

    # 複数店舗所属に対応するため、既に別の店舗に所属していても参加リクエストは送れる。
    # ただし対象店舗に既に所属している場合は拒否する。
    if UserShop.query.filter_by(user_id=user_id, shop_id=shop.id).first():
        return jsonify({"error": "既にその店舗に所属しています"}), 400

    # 4. リクエスト送信（Userモデルの暫定カラムを更新）
    # 保留中のリクエストが既にある場合（1ユーザーにつき同時に1件まで）は拒否する。
    # 「読み取ってから書き込む」実装だと同時リクエストで両方がshop_request_code未設定を
    # 読んでしまい後勝ちで上書きされうるため、shop_request_codeがNULLの場合のみ更新する
    # 原子的なUPDATEで防ぐ。
    result = db.session.execute(
        update(User)
        .where(User.id == user_id, User.shop_request_code.is_(None))
        .values(shop_request_code=shop_code)
    )
    if result.rowcount == 0:
        db.session.rollback()
        return jsonify({"error": "既に保留中の参加リクエストがあります"}), 400
    db.session.commit()

    return jsonify({"message": f"店舗 '{shop.name}' への参加リクエストをオーナーに送信しました。"}), 200

# -------------------- API: 参加リクエスト一覧取得 (Admin専用) --------------------
@shops_bp.route("/api/join_requests", methods=["GET"])
@jwt_required()
def get_join_requests():
    # 1. JWTからユーザー情報と権限をチェック
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    role = user.role
    shop_id = user.shop_id
    if role != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    # 2. 自分の店舗コードを取得
    shop = db.session.get(Shop, shop_id) # shop_id はトークンから取得済み
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404

    target_code = shop.shop_code

    # 3. その店舗コードでリクエスト中のユーザーを全て検索
    # 複数店舗所属に対応するため、既に別の店舗に所属しているユーザーからのリクエストも対象に含める
    requests = User.query.filter(
        User.shop_request_code == target_code
    ).all()

    # 4. JSON形式でリクエストユーザーの一覧を返す (ロジックは変更なし)
    request_list = [{
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "request_date": "N/A"
    } for user in requests]

    return jsonify({"requests": request_list}), 200


# -------------------- API: 参加リクエスト承認/拒否 (Admin専用) --------------------
@shops_bp.route("/api/join_requests/<int:user_id>", methods=["POST"])
@jwt_required()
def handle_join_request(user_id):
    # 1. JWTから管理者ユーザー情報と権限をチェック
    admin_id_str = get_jwt_identity()
    admin_id = int(admin_id_str)

    admin_user = db.session.get(User, admin_id)
    if not admin_user:
        return jsonify({"error": "管理者ユーザーが見つかりません"}), 404

    role = admin_user.role
    admin_shop_id = admin_user.shop_id
    if role != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not admin_shop_id:
        # 自分の店舗がないと承認できない
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    data = request.json
    action = data.get("action") # 'approve' または 'reject'

    # 2. 対象ユーザーを取得
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "対象ユーザーが見つかりません"}), 404

    # 対象ユーザーが実際に自分の店舗への参加をリクエストしていたかを検証する。
    # 検証しないと、URLパスのuser_idを変えるだけで参加リクエストを送っていない
    # 任意のユーザーや、既に他店舗に所属済みのユーザーを自店舗に強制加入させられてしまう。
    admin_shop = db.session.get(Shop, admin_shop_id)
    if not admin_shop or target_user.shop_request_code != admin_shop.shop_code:
        return jsonify({"error": "対象ユーザーからの参加リクエストが見つかりません"}), 404

    # 3. アクションの実行
    if action == "approve":
        # 承認処理: user_shopsに所属関係を追加し、リクエストコードをクリアする。
        # アクティブ店舗（shop_id）が未設定の場合のみ、承認した店舗を自動でアクティブにする。
        # 既に別の店舗がアクティブな場合は変更しない（切り替えは別途アクティブ店舗切替APIで行う）。
        ensure_user_shop_membership(target_user.id, admin_shop_id)
        if not target_user.shop_id:
            target_user.shop_id = admin_shop_id
        target_user.shop_request_code = None
        message = f"ユーザー {target_user.name} を店舗に承認しました。次回ログイン時にユーザーのトークンが更新されます。"

    elif action == "reject":
        # 拒否処理: リクエストコードのみをクリア
        target_user.shop_request_code = None
        message = f"ユーザー {target_user.name} の参加リクエストを拒否しました。"

    else:
        return jsonify({"error": "無効なアクションです"}), 400

    db.session.commit()

    return jsonify({"message": message}), 200

# -------------------- API: 店舗詳細取得 --------------------
@shops_bp.route("/api/shop/<int:shop_id>", methods=["GET"])
@jwt_required()
def get_shop_detail(shop_id):
    # 1.ユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    user_shop_id = user.shop_id

    # 2. アクセス権限のチェック
    # ユーザーが店舗に所属していない場合 (None) または、
    # リクエストされた shop_id (URL) が所属店舗ID (トークン) と一致しない場合
    if not user_shop_id or user_shop_id != shop_id:
        return jsonify({"error": "アクセス権限がありません"}), 403 # 403 Forbidden

    # 3. 店舗が存在するかチェック
    # アクセス権限チェックで実質的にチェック済みだが、念のためDBから取得
    shop = db.session.get(Shop, shop_id)
    if not shop:
         # 非常に稀なケース（ユーザーのshop_idがDBから削除された場合など）
        return jsonify({"error": "店舗が見つかりません"}), 404

    # 4. JSONで返す (ロジックは変更なし)
    return jsonify({
        "name": shop.name,
        "location": shop.location,
        "shop_code": shop.shop_code,
        "shop_id": shop.id,
        "config": {
            "max_staff": 5,  # デフォルト値
            "min_staff": 1   # デフォルト値
        }
    })

# -------------------- API: 店舗情報更新 (Admin専用) --------------------
@shops_bp.route("/api/shop/<int:shop_id>", methods=["POST"])
@jwt_required()
def update_shop_detail(shop_id):
    # 1. JWTから管理者情報と権限を取得
    admin_id_str = get_jwt_identity()
    admin_id = int(admin_id_str)

    admin_user = db.session.get(User, admin_id)
    if not admin_user:
        return jsonify({"error": "管理者ユーザーが見つかりません"}), 404

    role = admin_user.role
    admin_shop_id = admin_user.shop_id

    # 2. 権限と自分の管理店舗IDかチェック
    if role != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not admin_shop_id or admin_shop_id != shop_id:
        return jsonify({"error": "自分の管理する店舗の情報しか更新できません"}), 403

    shop = db.session.get(Shop, shop_id)
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404

    data = request.json
    new_name = data.get("name")
    new_location = data.get("location")

    # 店舗名が変更されたかどうかのフラグ
    name_changed = False

    # 3. 店舗名の重複チェック (更新対象の店舗名自身は除外する)
    if new_name and new_name != shop.name:
        if Shop.query.filter_by(name=new_name).first():
            return jsonify({"error": "その店舗名は既に使われています"}), 400

        name_changed = True # 店舗名変更フラグを立てる

    # 4. データ更新
    if new_name:
        shop.name = new_name
        # session["shop_name"] = new_name # セッション更新は削除
    if new_location is not None:
        shop.location = new_location

    db.session.commit()

    # 5. 店舗名が変更された場合は、ID文字列を含むJWTを再発行
    if name_changed:
        # 修正: identityには必ずユーザーIDの文字列を渡す
        new_access_token = create_access_token(identity=str(admin_user.id))
        new_refresh_token = create_refresh_token(identity=str(admin_user.id))

        # レスポンスオブジェクトの生成とクッキーへのセット
        response = jsonify({
            "message": "店舗情報を更新しました。トークンを更新しました。",
            "updated_shop_name": shop.name # クライアントが最新情報を取得できるようにする
        })
        set_access_cookies(response, new_access_token)
        set_refresh_cookies(response, new_refresh_token)

        return response, 200

    # 店舗名が変わらなかった場合は、通常のレスポンスを返す
    return jsonify({"message": "店舗情報を更新しました"}), 200

# -------------------- API: 店舗の従業員一覧取得 --------------------
@shops_bp.route("/api/shops/<int:shop_id>/users", methods=["GET"])
@jwt_required()
def get_shop_users(shop_id):
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    user_shop_id = user.shop_id

    # 2. 権限チェック: ユーザーが要求された店舗に所属しているか？
    # ユーザーが店舗に所属していない場合 (None) または、
    # リクエストされた shop_id (URL) が所属店舗ID (トークン) と一致しない場合
    if not user_shop_id or user_shop_id != shop_id:
        return jsonify({"error": "この店舗の情報にアクセスする権限がありません"}), 403

    # 3. 店舗に所属する全ユーザーを取得 (ロジックは変更なし)
    users_in_shop = User.query.filter_by(shop_id=shop_id).all()

    user_list = []
    for user in users_in_shop:
        user_list.append({
            "user_id": user.id,
            "user_name": user.name,
            "role": user.role,
            "position": user.position,
            "is_owner": user.role == 'admin' # 'owner'がDBになければ'admin'で判断
        })

    # 4. 店舗情報を取得
    shop = db.session.get(Shop, shop_id)
    # 権限チェックでshop_idが有効と分かっているため、shopが存在しない可能性は低いが念のためチェック
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404

    shop_info = {
        "id": shop.id,
        "name": shop.name,
        "location": shop.location
    }

    return jsonify({
        "shop": shop_info,
        "users": user_list
    }), 200

# -------------------- API: 従業員のポジション更新 (Admin専用) --------------------
@shops_bp.route("/api/shops/<int:shop_id>/users/<int:target_user_id>/position", methods=["PATCH"])
@jwt_required()
def update_user_position(shop_id, target_user_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    if user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    target_user = db.session.get(User, target_user_id)
    if not target_user or target_user.shop_id != shop_id:
        return jsonify({"error": "対象の従業員が見つかりません"}), 404

    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "リクエストボディが不正です"}), 400

    position = data.get("position")
    if position is not None:
        if not isinstance(position, str):
            return jsonify({"error": "positionは文字列で指定してください"}), 400
        position = position or None  # 空文字は未設定(None)として扱う
        if position and len(position) > 50:
            return jsonify({"error": "positionは50文字以内で指定してください"}), 400
        # UNSPECIFIED_POSITIONは自動調整の「position未設定」バケットの予約語のため、
        # 実際のposition名として使われるとNoneのシフトと定員が混同されてしまう
        if position == UNSPECIFIED_POSITION:
            return jsonify({"error": f'"{UNSPECIFIED_POSITION}"は予約語のためpositionに指定できません'}), 400

    target_user.position = position
    db.session.commit()

    return jsonify({"user_id": target_user.id, "position": target_user.position}), 200
