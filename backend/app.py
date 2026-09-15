# frontend/app.py


import os
from flask import Flask, request, jsonify
from models import db, User, Shop, Shift, AutoAdjustConfig, ShiftRejectionHistory
from flask_cors import CORS
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta, date, time
import random
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import time as pytime
import math
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
import sentry_sdk

from extensions import limiter
from services.shift_lock import ShiftLockConflict, acquire_shop_shift_lock
from services.rejection_history import get_current_year_month
from services.position import UNSPECIFIED_POSITION

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

app.register_blueprint(rejection_history_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(shops_bp)
app.register_blueprint(shifts_bp)

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
# -------------------- 自動調整ロジック補助関数 --------------------
# シフト確定・自動調整の排他制御（ShiftLockConflict, acquire_shop_shift_lock）は
# services/shift_lock.py に、棄却履歴関連（get_current_year_month, get_or_create_history）は
# services/rejection_history.py に切り出し済み（PBI #40）
def _parse_hour_float(t):
    # t: datetime.time -> float hour (e.g. 9:30 -> 9.5)
    return t.hour + t.minute / 60.0


def _normalize_capacities_map(capacities_map):
    """
    capacities_mapを新形式（ポジション別 {"<position>": {"<hour>": int}}）に正規化する。
    フロントエンド未対応期間（SBI #66未マージ時点）は旧形式のフラットな
    {"<hour>": int} がそのまま送られてくるため、値がdictでなければ
    UNSPECIFIED_POSITIONバケットの定員として扱う。
    """
    if not capacities_map:
        return {}
    if any(not isinstance(v, dict) for v in capacities_map.values()):
        return {UNSPECIFIED_POSITION: capacities_map}
    return capacities_map


def _is_valid_hour_capacity_dict(hour_caps):
    """{"<hour>": int} 形式（0〜23の整数キー・0以上の整数値）かどうかを検証する。
    bool は int のサブクラスのため明示的に除外し、小数値もint()での暗黙切り捨てを許さず拒否する。
    "1"と"01"のように正規化後に衝突するキーも、_get_position_capsでの黙った上書きを防ぐため拒否する。"""
    if not isinstance(hour_caps, dict):
        return False
    seen_hours = set()
    for hour_key, cap_value in hour_caps.items():
        if isinstance(cap_value, bool) or not isinstance(cap_value, int):
            return False
        try:
            hour = int(hour_key)
        except (TypeError, ValueError):
            return False
        if hour in seen_hours:
            return False
        seen_hours.add(hour)
        if not (0 <= hour <= 23) or cap_value < 0:
            return False
    return True


def _is_valid_capacities_map(capacities_map):
    """
    保存前のcapacitiesの形式検証。旧形式（フラット {"<hour>": int}）・
    新形式（ポジション別 {"<position>": {"<hour>": int}}）のいずれかであることを確認する。
    _normalize_capacities_mapは値の一部でもdict以外ならフラット扱いにするため、
    形式が混在したデータ（int()変換に失敗しcompute_auto_assignmentsが500になる）を弾く。
    """
    if not isinstance(capacities_map, dict):
        return False
    if not capacities_map:
        return True
    values_are_dicts = [isinstance(v, dict) for v in capacities_map.values()]
    if any(values_are_dicts) and not all(values_are_dicts):
        return False
    if all(values_are_dicts):
        return all(_is_valid_hour_capacity_dict(v) for v in capacities_map.values())
    return _is_valid_hour_capacity_dict(capacities_map)


# -------------------- 自動調整ロジック本体 --------------------
def compute_auto_assignments(request_shifts, priorities_map, capacities_map, shop_id=None):
    """
    シフト自動調整ロジック。
    優先度が同じグループ内では「累積棄却率が高い人」を優先することで
    長期的な棄却の偏りを防ぐ。
 
    Args:
        request_shifts: Shiftオブジェクトのリスト (shift_type=='request')
        priorities_map: {str(user_id): priority_int}
        capacities_map: {"<position>": {"0": int, ..., "23": int}} ポジション別・各時間帯の定員。
            positionが設定されていないシフトはUNSPECIFIED_POSITIONバケットで扱う。
        shop_id: 棄却履歴を参照するための店舗ID (Noneの場合は履歴を使わない)

    Returns:
        assignments: [{"user_id": int, "start_time": str, "end_time": str, "position": str|None}, ...]
        metrics: {
            "users": {user_id: {"accepted": int, "total": int, "rate": float}},
            "overall": {"accepted": int, "total": int, "rate": float}
        }
    """
    # --- 定員マップの準備（ポジション別） ---
    # capacities_map: {"<position>": {"<hour>": int}}。positionが空文字列("")のシフトはUNSPECIFIED_POSITIONバケットで扱う。
    # 対象positionのcapacitiesが未設定の場合は全時間帯上限なし（後方互換）。
    capacities_map = _normalize_capacities_map(capacities_map)
    position_caps = {}

    def _get_position_caps(position_key):
        if position_key not in position_caps:
            raw = (capacities_map or {}).get(position_key, {}) or {}
            caps = {int(k): int(v) for k, v in raw.items()}
            for h in range(24):
                caps.setdefault(h, 9999)  # 未設定時間帯は上限なし
            position_caps[position_key] = caps
        return position_caps[position_key]

    # --- 棄却履歴の取得 ---
    # shop_idがある場合のみDBから引く（シミュレーション時も参照する）
    rejection_rate_map = {}  # {user_id: float}
    if shop_id is not None:
        histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
        for h in histories:
            # 月次リセットが必要な場合は率を0扱いにする
            if h.reset_mode == 'monthly':
                current_ym = get_current_year_month()
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
            "position": s.position or UNSPECIFIED_POSITION,
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
        caps = _get_position_caps(r['position'])

        # 全時間帯でそのpositionの定員に空きがあるか確認
        can_assign = all(caps.get(h, 0) > 0 for h in hours)

        if can_assign:
            # 定員を消費
            for h in hours:
                caps[h] = caps.get(h, 0) - 1
            assignments.append({
                "user_id": uid,
                "start_time": r['shift'].start_time.strftime('%H:%M'),
                "end_time": r['shift'].end_time.strftime('%H:%M'),
                "position": r['shift'].position,
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
    # ボディなし・JSON null・非オブジェクトはいずれもrequest.jsonがNoneまたは非dictになるため、
    # 空設定として黙って保存せず一律400で拒否する
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    priorities = data.get("priorities", {})
    capacities = data.get("capacities", {})
    options = data.get("options", {})

    if not _is_valid_capacities_map(capacities):
        return jsonify({"error": "capacitiesの形式が不正です"}), 400

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

    if apply_flag:
        # 割当計算の元になるデータ取得より前にロックを取得し、
        # 「読み取り→計算→書き込み」の一連の処理全体を他リクエストと排他にする
        try:
            acquire_shop_shift_lock(user.shop_id)
        except ShiftLockConflict:
            return jsonify({"error": "他の管理者がシフト確定処理中です。しばらくしてから再度お試しください。"}), 409

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
                    position=a.get('position'),
                    shift_type='confirmed'
                )
                db.session.add(new_shift)
            db.session.commit()
            return jsonify({"message": "自動確定を適用しました", "assignments": assignments, "metrics": metrics}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"適用に失敗しました: {str(e)}"}), 500

    return jsonify({"assignments": assignments, "metrics": metrics}), 200

# 棄却履歴の閲覧・リセット関連エンドポイントは blueprints/rejection_history.py に切り出し済み（PBI #40）
# セッション取得エンドポイントは blueprints/auth.py に切り出し済み（PBI #40）

# 開発用
if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

