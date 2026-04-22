# frontend/app.py


import os
from flask import Flask, request, jsonify, session
from models import db, User, Shop, Shift, AutoAdjustConfig, ShiftRejectionHistory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime, timedelta, date, time
import random, string
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import time as pytime
import math
from flask_jwt_extended import create_access_token, JWTManager, jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from flask_jwt_extended import create_refresh_token, set_refresh_cookies

load_dotenv()

app = Flask(__name__)

# JWTの設定
app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY", "super-secret-jwt-key") # 秘密鍵を設定
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"] 
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
app.config["JWT_COOKIE_SECURE"] = True # HTTPSでのみクッキーを送信 (本番環境向けではTrue、開発中はFalse)
app.config["JWT_COOKIE_SAMESITE"] = "None" # CSRF対策のためLaxまたはStrict
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1) # トークンの有効期限
app.config["JWT_ACCESS_COOKIE_PATH"] = "/"

# CSRF保護を一時的に無効化する設定
app.config["JWT_COOKIE_CSRF_PROTECT"] = False

jwt = JWTManager(app)

#app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

#app.secret_key = os.getenv("SECRET_KEY", "your_strong_secret_key_here")  


# -------------------- Render/PostgreSQL 互換性修正 (必須) --------------------
# RenderのPostgreSQLは 'postgres://' スキームで提供されるが、SQLAlchemy 2.0+ は 
# 'postgresql://' を推奨するため、URIを修正する。
database_url = os.getenv("DATABASE_URL", "sqlite:///shifts.db")
if database_url and database_url.startswith("postgres://"):
    # スキームを 'postgres://' から 'postgresql://' に置き換える
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 接続プールのリサイクルを有効にする (PostgreSQLのアイドルタイムアウト対策)
app.config['SQLALCHEMY_POOL_RECYCLE'] = 280 
# 接続プールサイズをGunicornワーカー数(4)に合わせて設定する
app.config['SQLALCHEMY_POOL_SIZE'] = 5 

db.init_app(app)

# Vercelの公開URLを設定するための環境変数を定義
FRONTEND_URL = os.getenv("FRONTEND_URL") 

# 許可するオリジンをリスト形式で定義
# VercelのURLとローカルホストを両方許可することで、クッキー送信を確実にします。
allowed_origins = [
    "http://localhost:3000", # ローカル開発環境用
    "http://localhost:60146", # Flutter開発環境用
    FRONTEND_URL             # Vercelのカスタムドメイン/プライマリURL
]
# Noneを除外する（念のため）
final_origins = [o for o in allowed_origins if o is not None]

CORS(
    app,
    # resourcesを使う形式を維持し、originsにリストを渡す
    resources={r"/api/*": {"origins": final_origins}},
    supports_credentials=True, 
    allow_headers=["Content-Type", "Authorization"] 
)

# -------------------- JWTエラーハンドリング --------------------
# トークンがない、または不正な場合のカスタムレスポンスを設定
# トークンの形式が不正な場合、デフォルトで422を返すため、それをキャッチする。

@jwt.invalid_token_loader
def invalid_token_callback(error):
    # トークンの形式がおかしい場合（例：ヘッダーがない、ペイロードが不正）
    # フロントエンドが401として扱えるようにする
    return jsonify({
        "msg": "Invalid token provided. Signature verification failed.",
        "error": error
    }), 401

@jwt.unauthorized_loader
def unauthorized_callback(error):
    # トークンが存在しない場合（@jwt_required() がないルートではこれは発動しないが、保険として）
    return jsonify({
        "msg": "Missing Authorization Header or token expired/invalid.",
        "error": error
    }), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    # トークンの有効期限が切れている場合
    return jsonify({
        "msg": "The token has expired",
        "error": "token_expired"
    }), 401

# 422エラーをキャッチするハンドラを追加
# JWTのペイロードが要求された形式でないなどの場合に発生しがち
from flask_jwt_extended.exceptions import NoAuthorizationError
from werkzeug.exceptions import UnprocessableEntity

# Flask-JWT-Extendedの仕様上、トークンが不正な形式だと422が発生することが多い。
@app.errorhandler(422)
def handle_422_error(err):
    # 422エラーがJWT関連のエラー由来か、他のバリデーションエラー由来かを切り分けるのは難しいが、
    # とりあえずJSONレスポンスを返すように統一する。
    # 実際のエラーメッセージをログに残すなどしてデバッグに役立てる。
    print(f"Caught 422 error: {err}")
    
    # ここでは、JWTが不正な形式だった場合に備えて、フロントが扱えるJSONレスポンスを返す。
    return jsonify({
        "msg": "Unprocessable Entity: The request data or token format was invalid.",
        "errors": getattr(err, 'description', ['Invalid data or token format.'])
    }), 422
    
# -----------------------------------------------------------

# -------------------- DBセッションの自動クローズ (Gunicorn環境で必須) --------------------
@app.teardown_request
def shutdown_session(exception=None):
    # リクエスト終了時に、エラーの有無に関わらずセッションを確実にクローズ/解放する
    # これにより、次のリクエストでは新しい接続が確立され、接続切断エラーを防ぐ
    db.session.remove()

# -------------------- DB接続待機 --------------------
def wait_for_db():
    with app.app_context():
        # 最大20秒間、2秒間隔でデータベース接続を試行する
        print("INFO: Waiting for database connection...")
        for i in range(10): 
            try:
                # 接続テスト: 単純なSQLを実行してみる
                db.session.execute(text('SELECT 1')) 
                print("INFO: Database connection successful!")
                return # 成功したら終了
            except Exception as e:
                # 失敗したら待機
                print(f"WARNING: DB not ready yet (attempt {i+1}/10). Waiting 2 seconds...")
                pytime.sleep(2)
        
        # 10回試行しても接続できなかった場合
        print("ERROR: Database connection failed after multiple retries.")
        # ここで終了するとWebサービスもクラッシュするので、そのまま続行させる（init_dbで失敗する）

# -------------------- DB初期化 --------------------
def init_db():
    with app.app_context():
        db.create_all()
        
        # teststore1の追加
        shop = Shop.query.filter_by(name='teststore1').first()
        if not shop:
            shop = Shop(name='teststore1',
                        location=None,
                        shop_code=Shop.generate_unique_code(),
                        open_time=time(9, 0),
                        close_time=time(22, 0)
                        )
            db.session.add(shop)
            db.session.flush()
            
        # 初期ユーザーの追加
        admin = User.query.filter_by(name='admin').first()
        if not admin:
            admin = User(name='admin', email='admin@example.com', role='admin', password=generate_password_hash('pass'), shop_id=shop.id)
            db.session.add(admin)
        elif not admin.shop_id:
            # 既存のadminが shop_id を持たない場合は設定
            admin.shop_id = shop.id

        # 10人のスタッフを追加
        staff_names = ['yamada', 'sato', 'suzuki', 'taro', 'hanako', 'jiro', 'sakura', 'akira', 'yuki', 'hana']
        staff_list = []
        for name in staff_names:
            email = f'{name}@example.com'
            if not User.query.filter_by(name=name).first():
                staff = User(name=name, email=email, role='staff', password=generate_password_hash('pass'), shop_id=shop.id)
                staff_list.append(staff)
        if staff_list:
            db.session.add_all(staff_list)

        db.session.commit()

        # デモ用シフト希望の追加（まだシフトが登録されていない場合）
        if Shift.query.filter_by(shop_id=shop.id).count() == 0:
            staff = User.query.filter_by(shop_id=shop.id, role='staff').all()
            today = date.today()

            # 30日間分のシフト希望を作成
            for shift_days in range(30):
                current_date = today + timedelta(days=shift_days)

                # 各スタッフに対して、85%の確率でシフト希望を作成（自動調整で棄却されるようにするため）
                for s in staff:
                    if random.random() < 0.85:  # 85%の確率
                        # ランダムなシフト時間を生成（4-8時間）
                        start_hour = random.randint(9, 18)  # 9時～18時の間でスタート
                        duration = random.randint(4, 8)  # 4～8時間の勤務
                        end_hour = min(start_hour + duration, 22)  # 営業終了時刻（22:00）を超えないように調整

                        shift = Shift(
                            user_id=s.id,
                            shop_id=shop.id,
                            shift_date=current_date,
                            start_time=time(start_hour, 0),
                            end_time=time(end_hour, 0),
                            shift_type='request'
                        )
                        db.session.add(shift)

            db.session.commit()

        # デモ用の自動調整設定を追加（定員を制限して棄却が出るようにする）
        config = AutoAdjustConfig.query.filter_by(shop_id=shop.id).first()
        if not config:
            # 時間帯ごとの定員を設定（棄却が出るように少なめに）
            capacities = {
                str(h): 3 if 12 <= h <= 18 else 4  # ランチタイム（12-18時）は3人、それ以外は4人
                for h in range(24)
            }
            config = AutoAdjustConfig(shop_id=shop.id, priorities={}, capacities=capacities, options={})
            db.session.add(config)
            db.session.commit()

# --------------------　手動初期化用URL　--------------------        
@app.route('/init-db')
def manual_init_db():
    try:
        init_db()
        return "DB初期化成功", 200
    except Exception as e:
        return f"エラー : {str(e)}", 500

# -------------------- API: ユーザー登録 --------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "staff") # 登録時には role は 'staff' などのデフォルト値が設定されることを想定

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
    
    # 1. JWTペイロードに保存する情報を定義
    identity_data = {
        "user_id": user.id,
        "user_name": user.name,
        "role": user.role,
        "shop_id": user.shop_id # 登録直後は None になるはず
    }
    
    # 2. アクセストークンを生成
    access_token = create_access_token(identity=str(user.id)) 
    
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
@app.route("/api/account/edit", methods=["POST"])
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
@app.route("/api/account/delete", methods=["POST"])
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

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "アカウントの削除中にエラーが発生しました"}), 500

# -------------------- API: ログイン (JWT対応版) --------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    identifier = data.get("identifier")
    password = data.get("password")

    # 名前またはメールアドレスでユーザーを検索
    user = User.query.filter((User.name==identifier)|(User.email==identifier)).first()
    
    if user and check_password_hash(user.password, password):
        # ユーザーに紐づく店舗名を取得 (user.shopがNoneの場合を安全にチェック)
        shop_name_val = user.shop.name if user.shop else None
        
        # 1. JWTペイロードに保存する情報を定義
        identity_data = {
            "user_id": user.id,
            "user_name": user.name,
            "role": user.role,
            "shop_id": user.shop_id
        }
        
        # 2. アクセストークンを生成
        access_token = create_access_token(identity=str(user.id)) 

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
@app.route("/api/logout", methods=["POST"])
def logout():
    # 1. レスポンスオブジェクトを生成
    response = jsonify({"message": "ログアウト成功"})
    
    # 2. JWT クッキーを削除 (クライアントにトークン破棄を指示)
    # クッキーを使ってJWTをやり取りしている場合に必須
    unset_jwt_cookies(response) 
    
    return response, 200 # 修正後のレスポンスを返す

# -------------------- API: シフト提出  --------------------
@app.route("/api/shifts/submit_request", methods=["POST"]) 
@jwt_required()
def submit_shift_request():
    # 1. ログイン/所属店舗チェック (JWTからユーザー情報を取得)
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    # DBから最新のユーザー情報を取得して shop_id を確認する
    user = db.session.get(User, user_id)
    if not user:
        # トークンは有効だがユーザーがDBに存在しない場合
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    
    shop_id = user.shop_id
    
    # jwt_required() によりログインチェックは不要
    if not shop_id:
        return jsonify({"error": "店舗に所属していません"}), 400

    data = request.json
    submitted_requests = data.get("requests", []) 

    if not submitted_requests:
        return jsonify({"error": "シフトデータがありません"}), 400

    # 提出されたリクエストは全て同じ日付のはずなので、最初のエントリから日付を取得
    date_str = submitted_requests[0].get("date") 
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 2. 同じ日の既存の 'request' シフトを全て削除 (上書き提出と見なす)
    Shift.query.filter(
        Shift.user_id == user_id, 
        Shift.shift_date == target_date,
        Shift.shift_type == 'request'
    ).delete(synchronize_session='fetch')
    
    # 3. 新しいシフト希望を全て Shift モデルに登録
    new_request_count = 0
    
    for req_data in submitted_requests:
        start_time_str = req_data.get("start")
        end_time_str = req_data.get("end")

        if not start_time_str or start_time_str == "00:00" or not end_time_str or end_time_str == "00:00":
             continue
        
        try:
            start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
            end_time_obj = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
             continue
        
        # Shiftモデルにデータを格納
        new_shift = Shift(
            user_id=user_id,
            shop_id=shop_id,
            shift_date=target_date,
            start_time=start_time_obj,
            end_time=end_time_obj,
            shift_type='request' # 希望として登録
        )
        db.session.add(new_shift)
        new_request_count += 1

    db.session.commit()

    return jsonify({"message": f"日付 {date_str} のシフト希望を{new_request_count}件登録しました！"})

# -------------------- API: 指定年月の店舗別シフト状況取得 (Admin専用) --------------------
@app.route("/api/admin/shifts/status/<int:year>/<int:month>", methods=["GET"])
@jwt_required()
def get_monthly_shift_status(year, month):
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    
    role = user.role
    shop_id = user.shop_id
    
    # 1. ログイン/権限/所属店舗チェック
    if role != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    try:
        # 2. 期間の計算
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
            
    except ValueError:
        return jsonify({"error": "年月の指定が不正です"}), 400

    # 3. 店舗の全シフト（希望/確定）を期間で取得 (ロジックは変更なし)
    all_shifts = Shift.query.filter(
        Shift.shop_id == shop_id,
        Shift.shift_date >= start_date,
        Shift.shift_date <= end_date,
        Shift.shift_type.in_(['request', 'confirmed']) 
    ).all()

    # 4. 日ごとのシフト状況を集計
    daily_status: dict[str, str] = {}
    
    # 全ての従業員（店舗所属者）を取得 (この行は shop_id を使っているので、変更なしで機能する)
    all_staff_ids = [u.id for u in User.query.filter(User.shop_id == shop_id).all()]
    
    # 対象期間内の全ての日付を生成
    current_day = start_date
    while current_day <= end_date:
        date_str = current_day.strftime('%Y-%m-%d')
        daily_status[date_str] = 'no_requests' 
        current_day += timedelta(days=1)

    # シフトデータを日付ごとにループ処理
    for shift in all_shifts:
        date_str = shift.shift_date.strftime('%Y-%m-%d')
        current_status = daily_status.get(date_str, 'no_requests')

        if shift.shift_type == 'confirmed':
            daily_status[date_str] = 'confirmed'
        elif shift.shift_type == 'request' and current_status != 'confirmed':
            daily_status[date_str] = 'requested'

    # 5. フロントエンドが期待する形式に変換（リスト形式）
    monthly_status_list = [
        {"date": date_str, "status": status}
        for date_str, status in daily_status.items()
    ]
    
    # 6. JSONレスポンスとして返す
    return jsonify({"monthly_status": monthly_status_list}), 200

# -------------------- API: 指定日のシフト一覧取得/調整用 (Admin専用) --------------------
@app.route("/api/admin/shifts/<date_str>", methods=["GET"])
@jwt_required()
def get_shifts_for_admin(date_str):
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str) # トークンから取得

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    role = user.role
    shop_id = user.shop_id
    
    # 1. ログイン/権限/所属店舗チェック
    if role != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    try:
        # 2. 日付を datetime.date オブジェクトに変換
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 3. 自分の店舗の、指定日における全てのシフトを取得 (ロジックは変更なし)
    shifts_data = Shift.query.filter(
        Shift.shop_id == shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type.in_(['request', 'confirmed']) # 希望と確定済みの両方を取得
    ).all()
    
    # 4. ユーザーごとにデータを整理 (ロジックは変更なし)
    staff_data = {}
    
    for shift in shifts_data:
        user_id_key = shift.user_id
        
        if user_id_key not in staff_data:
            staff_data[user_id_key] = {
                "user_id": user_id_key,
                "name": shift.user.name,
                "role": shift.user.role,
                "requests": [],
                "confirmed": []
            }
            
        shift_info = shift.to_dict() 
        
        if shift.shift_type == 'request':
            staff_data[user_id_key]['requests'].append(shift_info)
        elif shift.shift_type == 'confirmed':
            staff_data[user_id_key]['confirmed'].append(shift_info)

    return jsonify({"staff_shifts": list(staff_data.values())}), 200

# -------------------- API: シフト確定・手動調整 (Admin専用) --------------------
@app.route("/api/admin/shifts/confirm", methods=["POST"])
@jwt_required()
def confirm_shifts():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    
    role = user.role
    shop_id = user.shop_id
    
    if role != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400
 
    data = request.json
    confirmed_shifts_data = data.get("confirmed_shifts", [])
    
    if not confirmed_shifts_data:
        return jsonify({"error": "確定シフトデータがありません"}), 400
        
    try:
        date_str = confirmed_shifts_data[0]['shift_date']
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        target_user_ids = [shift['user_id'] for shift in confirmed_shifts_data]
 
        # ★ 削除前にリクエストを提出していたユーザーIDを全て取得
        # (削除後はリクエストがなくなるため、ここで記録しておく)
        all_requesting_user_ids = {
            s.user_id for s in Shift.query.filter(
                Shift.shop_id == shop_id,
                Shift.shift_date == target_date,
                Shift.shift_type == 'request',
                Shift.user_id.in_(target_user_ids)
            ).all()
        }
 
        # 既存シフトを削除
        shifts_to_delete = Shift.query.filter(
            Shift.shop_id == shop_id,
            Shift.shift_date == target_date,
            Shift.user_id.in_(target_user_ids) 
        ).all()
        for shift in shifts_to_delete:
            db.session.delete(shift)
        db.session.commit()
 
        # 新しい確定シフトを追加
        new_confirmed_shifts = []
        accepted_user_ids = set()
 
        for shift_data in confirmed_shifts_data:
            if 'user_id' not in shift_data or 'start_time' not in shift_data or 'end_time' not in shift_data:
                continue
             
            start_time_obj = datetime.strptime(shift_data['start_time'], '%H:%M').time()
            end_time_obj = datetime.strptime(shift_data['end_time'], '%H:%M').time()
            
            new_shift = Shift(
                user_id=shift_data['user_id'],
                shop_id=shop_id,
                shift_date=target_date,
                start_time=start_time_obj,
                end_time=end_time_obj,
                shift_type='confirmed'
            )
            db.session.add(new_shift)
            new_confirmed_shifts.append(new_shift)
            accepted_user_ids.add(shift_data['user_id'])
 
        # ★ 棄却履歴の更新
        # リクエストを提出していた全ユーザーに対してカウントを更新
        for uid in all_requesting_user_ids:
            history = _get_or_create_history(uid, shop_id)
            history.total_requests += 1
            if uid in accepted_user_ids:
                history.total_accepted += 1
 
        db.session.commit()
        return jsonify({"message": f"日付 {date_str} のシフトを{len(new_confirmed_shifts)}件確定しました。"}), 200
 
    except Exception as e:
        db.session.rollback()
        print(f"シフト確定エラー: {e}")
        return jsonify({"error": f"シフト確定処理中にエラーが発生しました: {str(e)}"}), 500
    
# -------------------- API: 指定日の自分の確定シフト取得 (Staff/Admin 向け) --------------------
@app.route("/api/shifts/<date_str>", methods=["GET"])
@jwt_required()
def get_shifts(date_str):
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
        
    shop_id = user.shop_id
    
    # 2. 所属店舗チェック
    # jwt_required() によりログインチェックは不要
    if not shop_id:
        # ユーザーオブジェクトの取得は不要になった
        return jsonify({"error": "所属店舗が登録されていません"}), 400
    
    try:
        # 3. 日付変換
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 4. 自分の確定シフトのみを取得 (ロジックは変更なし)
    shifts = Shift.query.filter(
        Shift.user_id == user_id,
        Shift.shop_id == shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type == 'confirmed'
    ).all()

    # 5. レスポンス整形
    if not shifts:
        return jsonify({"message": f"{date_str} の確定シフトはありません。", "confirmed_shifts": []}), 200

    confirmed_shifts_list = [shift.to_dict() for shift in shifts]

    return jsonify({"confirmed_shifts": confirmed_shifts_list}), 200

# -------------------- API: 指定年月の自分の全シフト取得 (Staff/Admin 向け) --------------------
@app.route("/api/shifts/month/<int:year>/<int:month>", methods=["GET"])
@jwt_required()
def get_user_shifts_by_month(year, month):
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    user = db.session.get(User, user_id)    
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404      
    if not user.shop_id:
        return jsonify({"error": "所属店舗が登録されていません"}), 400

    shop_id = user.shop_id

    try:
        # 3. 期間の計算
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
            
    except ValueError:
        return jsonify({"error": "年月の指定が不正です"}), 400

    # 4. 自分の全シフト（希望/確定）を取得 (ロジックは変更なし)
    shifts = Shift.query.filter(
        Shift.user_id == user_id,
        Shift.shop_id == shop_id,
        Shift.shift_date >= start_date,
        Shift.shift_date <= end_date,
        Shift.shift_type.in_(['request', 'confirmed']) # 希望と確定の両方
    ).all()

    # 5. レスポンス整形 (ロジックは変更なし)
    if not shifts:
        return jsonify({"message": f"{year}年{month}月のシフトはありません。", "shifts_by_date": {}}), 200

    # 日付ごとの辞書に格納 { "YYYY-MM-DD": [shift_dict, ...], ... }
    shifts_by_date = {}
    for shift in shifts:
        date_key = shift.shift_date.strftime('%Y-%m-%d')
        if date_key not in shifts_by_date:
            shifts_by_date[date_key] = []
        
        shifts_by_date[date_key].append(shift.to_dict()) 

    return jsonify({"shifts_by_date": shifts_by_date}), 200

# -------------------- API: 店舗登録 --------------------
@app.route("/api/shop_register", methods=["POST"])
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

    # 2. 店舗を登録
    code = Shop.generate_unique_code()
    shop = Shop(name=name, location=location, shop_code=code)
    db.session.add(shop)
    db.session.commit() # 店舗のID (shop.id) を確定させる
    
    # 3. 管理者ユーザーの情報を更新
    admin_user = User.query.get(manager_id)
    db.session.commit() # DBの変更をコミット
    
    # 4. 新しいshop_idを含むJWTペイロードを作成し、トークンを再発行する
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
@app.route('/api/join_shop/request', methods=['POST'])
@jwt_required()
def join_shop_request():
    data = request.get_json()
    shop_code = data.get('shop_code')
    
    # 1. JWTからユーザー情報を取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    # 2. ユーザーの取得と所属チェック
    user = db.session.get(User, user_id) 
    if not user:
         return jsonify({"error": "ユーザーが見つかりません"}), 404
    if user.shop_id: 
        return jsonify({"error": "既に店舗に所属しています"}), 400

    # 3. 店舗コードの検証
    shop = Shop.query.filter_by(shop_code=shop_code).first()
    if not shop:
        return jsonify({"error": "無効な店舗コードです"}), 404

    # 4. リクエスト送信（Userモデルの暫定カラムを更新）
    user.shop_request_code = shop_code
    db.session.commit()

    return jsonify({"message": f"店舗 '{shop.name}' への参加リクエストをオーナーに送信しました。"}), 200
    
# -------------------- API: 参加リクエスト一覧取得 (Admin専用) --------------------
@app.route("/api/join_requests", methods=["GET"])
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

    # 3. その店舗コードでリクエスト中のユーザーを全て検索 (ロジックは変更なし)
    requests = User.query.filter(
        User.shop_id == None, 
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
@app.route("/api/join_requests/<int:user_id>", methods=["POST"])
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

    # 3. アクションの実行
    if action == "approve":
        # 承認処理: user.shop_id を管理者の店舗IDに設定し、リクエストコードをクリア
        target_user.shop_id = admin_shop_id # ★ トークンから取得した shop_id を使用
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
@app.route("/api/shop/<int:shop_id>", methods=["GET"])
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
    
    # 設定テーブルからデータを取る
    config = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()

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
@app.route("/api/shop/<int:shop_id>", methods=["POST"])
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
@app.route("/api/shops/<int:shop_id>/users", methods=["GET"])
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

# -------------------- 自動調整ロジック補助関数 --------------------     
def _parse_hour_float(t):
    # t: datetime.time -> float hour (e.g. 9:30 -> 9.5)
    return t.hour + t.minute / 60.0

def _get_current_year_month():
    """現在の年月を 'YYYY-MM' 形式で返す"""
    return datetime.now().strftime('%Y-%m')
 
 
def _get_or_create_history(user_id: int, shop_id: int) -> ShiftRejectionHistory:
    """
    (user_id, shop_id) に対応する履歴レコードを取得または新規作成する。
    reset_mode='monthly' の場合、月が変わっていれば自動リセットする。
    """
    history = ShiftRejectionHistory.query.filter_by(
        user_id=user_id,
        shop_id=shop_id
    ).first()
 
    if not history:
        # 初回: 新規作成
        history = ShiftRejectionHistory(
            user_id=user_id,
            shop_id=shop_id,
            total_requests=0,
            total_accepted=0,
            reset_mode='manual',
            last_reset_year_month=_get_current_year_month()
        )
        db.session.add(history)
        return history
 
    # 月次リセットチェック
    if history.reset_mode == 'monthly':
        current_ym = _get_current_year_month()
        if history.last_reset_year_month != current_ym:
            # 月が変わっていたらリセット
            history.total_requests = 0
            history.total_accepted = 0
            history.last_reset_year_month = current_ym
 
    return history
 
 
def update_rejection_histories(shop_id: int, date, request_shifts, accepted_user_ids: set):
    """
    シフト確定時に棄却履歴を更新する。
 
    Args:
        shop_id: 対象店舗ID
        date: 対象日付
        request_shifts: その日の全リクエストシフトのリスト
        accepted_user_ids: 採用されたユーザーIDのset
    """
    # その日に希望を提出したユーザーIDを収集
    requesting_user_ids = {s.user_id for s in request_shifts}
 
    for user_id in requesting_user_ids:
        history = _get_or_create_history(user_id, shop_id)
        history.total_requests += 1
        if user_id in accepted_user_ids:
            history.total_accepted += 1
        # updated_at は onupdate で自動更新される

# -------------------- 自動調整ロジック本体 --------------------
def compute_auto_assignments(request_shifts, priorities_map, capacities_map, shop_id=None):
    """
    シフト自動調整ロジック。
    優先度が同じグループ内では「累積棄却率が高い人」を優先することで
    長期的な棄却の偏りを防ぐ。
 
    Args:
        request_shifts: Shiftオブジェクトのリスト (shift_type=='request')
        priorities_map: {str(user_id): priority_int}
        capacities_map: {"0": int, ..., "23": int} 各時間帯の定員
        shop_id: 棄却履歴を参照するための店舗ID (Noneの場合は履歴を使わない)
 
    Returns:
        assignments: [{"user_id": int, "start_time": str, "end_time": str}, ...]
        metrics: {
            "users": {user_id: {"accepted": int, "total": int, "rate": float}},
            "overall": {"accepted": int, "total": int, "rate": float}
        }
    """
    # --- 定員マップの準備 ---
    caps = {int(k): int(v) for k, v in (capacities_map or {}).items()}
    for h in range(24):
        caps.setdefault(h, 9999)  # 未設定時間帯は上限なし
 
    # --- 棄却履歴の取得 ---
    # shop_idがある場合のみDBから引く（シミュレーション時も参照する）
    rejection_rate_map = {}  # {user_id: float}
    if shop_id is not None:
        histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
        for h in histories:
            # 月次リセットが必要な場合は率を0扱いにする
            if h.reset_mode == 'monthly':
                current_ym = _get_current_year_month()
                if h.last_reset_year_month != current_ym:
                    rejection_rate_map[h.user_id] = 0.0
                    continue
            rejection_rate_map[h.user_id] = h.rejection_rate
 
    # --- リクエストリストの構築 ---
    reqs = []
    for s in request_shifts:
        sf = _parse_hour_float(s.start_time)
        ef = _parse_hour_float(s.end_time)
        duration = max(0.25, ef - sf)
        priority = int(priorities_map.get(str(s.user_id), 0))
        rejection_rate = rejection_rate_map.get(s.user_id, 0.0)
 
        reqs.append({
            "user_id": s.user_id,
            "start_f": sf,
            "end_f": ef,
            "duration": duration,
            "priority": priority,
            "rejection_rate": rejection_rate,  # 棄却率 (高いほど優先)
            "rand": random.random(),            # 同率時のタイブレーク
            "shift": s,
        })
 
    # --- ソート ---
    # 1. 優先度 高い順
    # 2. 同優先度内: 累積棄却率 高い順（過去に多く棄却された人を優先）
    # 3. 同棄却率: ランダム（毎回同じ人が有利にならないように）
    reqs.sort(key=lambda r: (
        -r['priority'],
        -r['rejection_rate'],
        r['rand']
    ))
 
    # --- 貪欲法による割当 ---
    assignments = []
    accepted_count = {}  # {user_id: int}
    total_count = {}     # {user_id: int}
 
    for r in reqs:
        uid = r['user_id']
        total_count[uid] = total_count.get(uid, 0) + 1
 
        # シフトがカバーする時間帯スロット (開始時刻の整数部〜終了時刻の切り上げ-1)
        hours = list(range(int(r['start_f']), math.ceil(r['end_f'])))
 
        # 全時間帯で定員に空きがあるか確認
        can_assign = all(caps.get(h, 0) > 0 for h in hours)
 
        if can_assign:
            # 定員を消費
            for h in hours:
                caps[h] = caps.get(h, 0) - 1
            assignments.append({
                "user_id": uid,
                "start_time": r['shift'].start_time.strftime('%H:%M'),
                "end_time": r['shift'].end_time.strftime('%H:%M'),
            })
            accepted_count[uid] = accepted_count.get(uid, 0) + 1
 
    # --- メトリクス計算 ---
    total_requests_all = sum(total_count.values())
    total_accepted_all = sum(accepted_count.values())
 
    metrics = {
        "users": {
            str(uid): {
                "accepted": accepted_count.get(uid, 0),
                "total": tot,
                "rate": accepted_count.get(uid, 0) / tot if tot > 0 else 0.0,
                "rejection_rate_before": round(rejection_rate_map.get(uid, 0.0), 4),
            }
            for uid, tot in total_count.items()
        },
        "overall": {
            "accepted": total_accepted_all,
            "total": total_requests_all,
            "rate": total_accepted_all / total_requests_all if total_requests_all > 0 else 0.0,
        }
    }
 
    return assignments, metrics

# -------------------- API: 自動調整の設定取得/保存 (Admin専用) --------------------
@app.route("/api/shop/<int:shop_id>/auto_adjust/config", methods=["GET", "POST"])
@jwt_required()
def shop_auto_adjust_config(shop_id):
    # JWTからユーザー取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    # 権限と店舗一致チェック（管理者のみ）
    if user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    if request.method == 'GET':
        cfg = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()
        if not cfg:
            return jsonify({"config": {"priorities": {}, "capacities": {}}}), 200
        return jsonify({"config": {"priorities": cfg.priorities or {}, "capacities": cfg.capacities or {}, "options": cfg.options or {}}}), 200

    # POST: 保存
    data = request.json or {}
    priorities = data.get("priorities", {})
    capacities = data.get("capacities", {})
    options = data.get("options", {})
    
    try:
        cfg = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()
        if not cfg:
            cfg = AutoAdjustConfig(shop_id=shop_id, priorities=priorities, capacities=capacities, options=options)
            db.session.add(cfg)
        else:
            cfg.priorities = priorities
            cfg.capacities = capacities
            cfg.options = options
        db.session.commit()
        return jsonify({"message": "設定を保存しました"}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": f"保存に失敗したで: {str(e)}"}), 500

# -------------------- API: 指定日のシフトを自動調整して確定 (Admin専用) --------------------    
@app.route("/api/admin/shifts/auto_adjust/<date_str>", methods=["POST"])
@jwt_required()
def admin_auto_adjust(date_str):
    """
    POST body: { "apply": true/false }
    - apply=false: シミュレーション結果を返すだけ
    - apply=true: DBに確定として保存（既存の該当ユーザー分のシフトは上書き）
    """
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    if user.role != 'admin' or not user.shop_id:
        return jsonify({"error": "権限がありません"}), 403

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    apply_flag = bool(request.json.get('apply', False)) if request.json else False

    # 取得: その日の全ての request シフト
    request_shifts = Shift.query.filter(
        Shift.shop_id == user.shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type == 'request'
    ).all()
    
    # 設定を取得
    cfg = AutoAdjustConfig.query.filter_by(shop_id=user.shop_id).first()
    priorities = cfg.priorities if cfg else {}
    capacities = cfg.capacities if cfg else {}

    assignments, metrics = compute_auto_assignments(request_shifts, priorities, capacities)

    if apply_flag:
        # DB更新: 指定ユーザーに対する既存シフトを削除して確定を追加する
        try:
            # 削除対象ユーザーID一覧
            user_ids = list({a['user_id'] for a in assignments})
            if user_ids:
                # delete existing confirmed/request for these users on that date (overwrite)
                Shift.query.filter(
                    Shift.shop_id == user.shop_id,
                    Shift.shift_date == target_date,
                    Shift.user_id.in_(user_ids)
                ).delete(synchronize_session='fetch')
            # insert new confirmed
            for a in assignments:
                st = datetime.strptime(a['start_time'], '%H:%M').time()
                et = datetime.strptime(a['end_time'], '%H:%M').time()
                new_shift = Shift(
                    user_id=a['user_id'],
                    shop_id=user.shop_id,
                    shift_date=target_date,
                    start_time=st,
                    end_time=et,
                    shift_type='confirmed'
                )
                db.session.add(new_shift)
            db.session.commit()
            return jsonify({"message": "自動確定を適用しました", "assignments": assignments, "metrics": metrics}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"適用に失敗しました: {str(e)}"}), 500

    return jsonify({"assignments": assignments, "metrics": metrics}), 200

# -------------------- API: 棄却履歴一覧取得 (Admin専用) --------------------
@app.route("/api/shop/<int:shop_id>/rejection_history", methods=["GET"])
@jwt_required()
def get_rejection_history(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
 
    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403
 
    histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
    return jsonify({"histories": [h.to_dict() for h in histories]}), 200
 
 
# -------------------- API: 棄却履歴リセット (Admin専用) --------------------
# reset_type: 'all' (全員リセット) / 'user' (特定ユーザーのみ)
@app.route("/api/shop/<int:shop_id>/rejection_history/reset", methods=["POST"])
@jwt_required()
def reset_rejection_history(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
 
    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403
 
    data = request.json or {}
    reset_type = data.get("reset_type", "all")   # 'all' or 'user'
    target_user_id = data.get("user_id")          # reset_type='user' の場合に必要
    current_ym = _get_current_year_month()
 
    try:
        if reset_type == "all":
            # 店舗の全スタッフをリセット
            histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
            for h in histories:
                h.total_requests = 0
                h.total_accepted = 0
                h.last_reset_year_month = current_ym
            db.session.commit()
            return jsonify({"message": f"{len(histories)}件の履歴をリセットしました。"}), 200
 
        elif reset_type == "user":
            if not target_user_id:
                return jsonify({"error": "user_idが必要です"}), 400
            history = ShiftRejectionHistory.query.filter_by(
                shop_id=shop_id, user_id=target_user_id
            ).first()
            if not history:
                return jsonify({"error": "履歴が見つかりません"}), 404
            history.total_requests = 0
            history.total_accepted = 0
            history.last_reset_year_month = current_ym
            db.session.commit()
            return jsonify({"message": "履歴をリセットしました。"}), 200
 
        else:
            return jsonify({"error": "reset_typeは 'all' または 'user' を指定してください"}), 400
 
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"リセット中にエラーが発生しました: {str(e)}"}), 500
 
 
# -------------------- API: リセットモード変更 (Admin専用) --------------------
# reset_mode: 'manual' or 'monthly'
@app.route("/api/shop/<int:shop_id>/rejection_history/reset_mode", methods=["POST"])
@jwt_required()
def update_reset_mode(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
 
    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403
 
    data = request.json or {}
    new_mode = data.get("reset_mode")
    target_user_id = data.get("user_id")  # Noneなら全員まとめて変更
 
    if new_mode not in ('manual', 'monthly'):
        return jsonify({"error": "reset_modeは 'manual' または 'monthly' を指定してください"}), 400
 
    try:
        query = ShiftRejectionHistory.query.filter_by(shop_id=shop_id)
        if target_user_id:
            query = query.filter_by(user_id=target_user_id)
        
        histories = query.all()
        for h in histories:
            h.reset_mode = new_mode
        
        db.session.commit()
        return jsonify({
            "message": f"{len(histories)}件のリセットモードを '{new_mode}' に変更しました。"
        }), 200
 
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"更新中にエラーが発生しました: {str(e)}"}), 500

# -------------------- API: セッション取得 (JWT対応版) --------------------
@app.route("/api/session")
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




# 開発用
if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

