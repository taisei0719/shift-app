# frontend/app.py


import os
from flask import Flask, jsonify
from models import db, User, Shop, Shift, AutoAdjustConfig
from flask_cors import CORS
from werkzeug.security import generate_password_hash
from datetime import timedelta, date, time
import random
from dotenv import load_dotenv
from sqlalchemy import text
import time as pytime
from flask_jwt_extended import JWTManager
import sentry_sdk

from extensions import limiter
from services.user_shops import backfill_user_shops

load_dotenv()

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    # send_default_pii はスタッフの個人情報（IP・リクエストヘッダー等）を外部のSentryへ送ることになるため、
    # 明示的なデータ取り扱いポリシーが無い現状では無効のままにする
    sentry_sdk.init(dsn=SENTRY_DSN, send_default_pii=False)

app = Flask(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("環境変数 SECRET_KEY が設定されていません。")

# JWTの設定
app.config["JWT_SECRET_KEY"] = SECRET_KEY # 秘密鍵を設定
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"] 
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
app.config["JWT_COOKIE_SECURE"] = True # HTTPSでのみクッキーを送信 (本番環境向けではTrue、開発中はFalse)
app.config["JWT_COOKIE_SAMESITE"] = "None" # frontend(Vercel)とbackend(Render)がクロスオリジンのため必須。CSRF対策は下記のCSRFトークン検証で行う
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1) # トークンの有効期限
app.config["JWT_ACCESS_COOKIE_PATH"] = "/"

app.config["JWT_COOKIE_CSRF_PROTECT"] = True

jwt = JWTManager(app)

limiter.init_app(app)

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
# Vercelのブランチ/プレビューデプロイ (例: shift-app-git-develop-taiseis-projects-dc838d86.vercel.app)
# はデプロイごとにURLが変わるため、プロジェクト固有のパターンを正規表現で許可する
final_origins.append(r"^https://shift-app-[a-z0-9-]+-taiseis-projects-dc838d86\.vercel\.app$")

CORS(
    app,
    # resourcesを使う形式を維持し、originsにリストを渡す
    resources={r"/api/*": {"origins": final_origins}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-CSRF-TOKEN"]
)

# -------------------- Blueprint登録 --------------------
# ドメインごとに切り出したBlueprintをここに追加していく（PBI #40）
from blueprints.rejection_history import rejection_history_bp  # noqa: E402
from blueprints.auth import auth_bp  # noqa: E402
from blueprints.shops import shops_bp  # noqa: E402
from blueprints.shifts import shifts_bp  # noqa: E402
from blueprints.auto_adjust import auto_adjust_bp  # noqa: E402

app.register_blueprint(rejection_history_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(shops_bp)
app.register_blueprint(shifts_bp)
app.register_blueprint(auto_adjust_bp)

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
            except Exception:
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

        # 既存のUser.shop_id（アクティブ店舗）をuser_shopsへバックフィルする（冪等）
        backfill_user_shops()

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

# 認証・アカウント関連エンドポイント（register, login, logout, session, account edit/delete）は
# blueprints/auth.py に切り出し済み（PBI #40）

# シフト希望提出・確定・取得関連エンドポイント（submit_shift_request, get_monthly_shift_status,
# get_shifts_for_admin, confirm_shifts, get_shifts, get_user_shifts_by_month）は
# blueprints/shifts.py に切り出し済み（PBI #40 / SBI #75）

# 店舗・参加リクエスト関連エンドポイント（shop_register, join_shop_request, get_join_requests,
# handle_join_request, get_shop_detail, update_shop_detail, get_shop_users, update_user_position）は
# blueprints/shops.py に切り出し済み（PBI #40）
# 自動調整の設定取得/保存・自動調整実行エンドポイント（shop_auto_adjust_config, admin_auto_adjust）と
# アルゴリズム本体（compute_auto_assignments等）は blueprints/auto_adjust.py, services/auto_adjust.py
# に切り出し済み（PBI #40 / SBI #76）

# 棄却履歴の閲覧・リセット関連エンドポイントは blueprints/rejection_history.py に切り出し済み（PBI #40）
# セッション取得エンドポイントは blueprints/auth.py に切り出し済み（PBI #40）

# 開発用
if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

