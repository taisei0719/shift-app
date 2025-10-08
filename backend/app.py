import os
from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import random, string
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
# 本番フロントのみ許可
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000") # 本番時は.envファイルでFRONTEND_URLを変更
CORS(
    app,
    origins=[FRONTEND_URL],
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],  # 必要なメソッドを指定
    allow_headers=["Content-Type", "Authorization"]
)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///shifts.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# -------------------- モデル定義（既存と同じ） --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shop.id'), nullable=True)
    shop = db.relationship("Shop", backref="users", uselist=False)

class ShiftRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.String(10), nullable=False)
    shifts = db.relationship('Shift', backref='request', cascade="all, delete-orphan")

class Shift(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    shift_request_id = db.Column(db.Integer, db.ForeignKey('shift_request.id'), nullable=False)
    time_slot = db.Column(db.String(20), nullable=False)

class Shop(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    location = db.Column(db.String(200), nullable=True)
    shop_code = db.Column(db.String(6), unique=True, nullable=False)

# -------------------- DB初期化 --------------------
def init_db():
    db.create_all()
    if not User.query.filter_by(name='admin').first():
        admin = User(name='admin', email='admin@example.com', role='admin', password=generate_password_hash('pass'))
        db.session.add(admin)
    if not User.query.filter_by(name='yamada').first():
        staff1 = User(name='yamada', email='yamada@example.com', role='staff', password=generate_password_hash('pass'))
        staff2 = User(name='sato', email='sato@example.com', role='staff', password=generate_password_hash('pass'))
        staff3 = User(name='suzuki', email='suzuki@example.com', role='staff', password=generate_password_hash('pass'))
        db.session.add_all([staff1, staff2, staff3])
    db.session.commit()


# -------------------- ユーティリティ --------------------
def generate_shop_code():
    while True:
        code = ''.join(random.choices(string.digits, k=6))
        if not Shop.query.filter_by(shop_code=code).first():
            return code

# -------------------- API: ユーザー登録 --------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "そのメールアドレスは既に登録済みです"}), 400

    user = User(
        name=name,
        email=email,
        role=role,
        password=generate_password_hash(password)
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "登録成功"}), 201

# -------------------- API: ログイン --------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    identifier = data.get("identifier")
    password = data.get("password")

    user = User.query.filter((User.name==identifier)|(User.email==identifier)).first()
    # print("login data:", request.json) # debaug
    if user and check_password_hash(user.password, password):
        session["user_id"] = user.id
        session["user_name"] = user.name
        session["role"] = user.role
        session["shop_id"] = user.shop_id
        session["shop_name"] = user.shop.name if user.shop else None
        return jsonify({"message": "ログイン成功", "user": {
            "user_name": user.name,
            "role": user.role,
            "shop_name": user.shop.name if user.shop else None,
            "shop_id": user.shop_id 
        }})
    return jsonify({"error": "ユーザー名かパスワードが違います"}), 401

# -------------------- API: ログアウト --------------------
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "ログアウト成功"})

# -------------------- API: シフト提出 --------------------
@app.route("/api/shift_input", methods=["POST"])
def shift_input():
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要です"}), 401

    data = request.json
    date = data.get("date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")

    shift_request = ShiftRequest(user_id=session["user_id"], date=date)
    db.session.add(shift_request)
    db.session.commit()

    shift = Shift(shift_request_id=shift_request.id, time_slot=f"{start_time}-{end_time}")
    db.session.add(shift)
    db.session.commit()

    return jsonify({"message": "シフト提出成功"})

# -------------------- API: 店舗登録 --------------------
@app.route("/api/shop_register", methods=["POST"])
def shop_register():
    # ★ ログイン状態とロールチェック
    if "user_id" not in session or session.get("role") != "admin": # 'user_id' in session のチェックも追加
        return jsonify({"error": "ログインが必要です、または権限がありません"}), 403

    data = request.json
    name = data.get("name")
    location = data.get("location")

    if Shop.query.filter_by(name=name).first():
        return jsonify({"error": "店舗名が既に存在します"}), 400

    code = generate_shop_code()
    shop = Shop(name=name, location=location, shop_code=code)
    db.session.add(shop)
    # 1. データベースにコミットして、新しく作った店舗のID (shop.id) を確定させる
    db.session.commit() 
    
    # 2. 現在ログイン中の管理者ユーザーを取得する
    manager_id = session["user_id"]
    admin_user = User.query.get(manager_id)
    
    if admin_user:
        # 3. 管理者ユーザーの shop_id を、今登録した店舗のIDで更新する
        admin_user.shop_id = shop.id 
        
        # 4. セッション情報も最新の店舗名で更新する (ログイン時にしか更新されへんから、ここで更新が必要)
        session["shop_name"] = shop.name 
        
        # 5. DBの変更をコミット
        db.session.commit() 

    return jsonify({
        "message": "店舗登録成功", 
        "shop_code": code,
        "shop_id": shop.id # 新しく追加
    })

# -------------------- API: シフト取得 --------------------
@app.route("/api/shifts/<date>", methods=["GET"])
def get_shifts(date):
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要です"}), 401

    user = db.session.get(User, session["user_id"])
    shop_id = user.shop_id
    if not shop_id:
        return jsonify({"error": "店舗未登録"}), 400

    shift_requests = (
        ShiftRequest.query.filter_by(date=date)
        .join(User)
        .filter(User.shop_id==shop_id)
        .join(Shift)
        .add_entity(User)
        .add_entity(Shift)
        .all()
    )

    schedule = {}
    for sr, u, s in shift_requests:
        schedule.setdefault(u.name, []).append(s.time_slot)

    return jsonify(schedule)

# -------------------- API: 店舗詳細取得 --------------------
@app.route("/api/shop/<int:shop_id>", methods=["GET"])
def get_shop_detail(shop_id):
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要です"}), 401
    
    user = db.session.get(User, session["user_id"])
    shop = db.session.get(Shop, shop_id)

    # 1. 店舗が存在するかチェック
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404
    
    # 2. ★アクセス権限のチェックをシンプルに！★
    # ユーザーの shop_id が None の場合や、リクエストされた shop_id と一致しない場合はアクセス拒否
    if user.shop_id != shop_id: 
        # 403 Forbidden を返すことで、フロントエンドの catch に飛んで「未登録」表示になる
        return jsonify({"error": "アクセス権限がありません"}), 403

    # 店舗情報が見つかったら、JSONで返す
    # ここまで来れば、ログイン済みで、かつ自分の所属店舗を見ていることが確定
    return jsonify({
        "name": shop.name,
        "location": shop.location,
        "shop_code": shop.shop_code,
        "shop_id": shop.id 
    })

# -------------------- API: 店舗情報更新 --------------------
@app.route("/api/shop/<int:shop_id>", methods=["POST"])
def update_shop_detail(shop_id):
    # 1. ログインチェックと権限チェック（管理者のみ許可）
    if "user_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403
    
    user = db.session.get(User, session["user_id"])
    
    # 2. 自分の店舗IDかチェック
    if user.shop_id != shop_id:
        return jsonify({"error": "自分の管理する店舗の情報しか更新できません"}), 403

    shop = db.session.get(Shop, shop_id)
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404

    data = request.json
    new_name = data.get("name")
    new_location = data.get("location")

    # 3. 店舗名の重複チェック (更新対象の店舗名自身は除外する)
    if new_name and new_name != shop.name:
        if Shop.query.filter_by(name=new_name).first():
            return jsonify({"error": "その店舗名は既に使われています"}), 400

    # 4. データ更新
    if new_name:
        shop.name = new_name
        # 店舗名が変わったらセッションも更新
        session["shop_name"] = new_name
    if new_location is not None:
        shop.location = new_location

    db.session.commit()
    
    return jsonify({"message": "店舗情報を更新しました"})

# -------------------- API: 店舗参加（shop_codeで紐付け） --------------------
@app.route("/api/join_shop", methods=["POST"])
def join_shop():
    # 1. ログインチェック
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要です"}), 401
    
    data = request.json
    shop_code = data.get("shop_code")

    if not shop_code:
        return jsonify({"error": "店舗コードを入力してください"}), 400

    # 2. 店舗コードで店舗を検索
    shop = Shop.query.filter_by(shop_code=shop_code).first()
    if not shop:
        return jsonify({"error": "その店舗コードは存在しません"}), 404
    
    # 3. ユーザーを取得して店舗に紐づけ
    user = db.session.get(User, session["user_id"])
    
    if user.shop_id is not None:
        # 既に所属している店舗と同じ店舗なら、成功メッセージを返す
        if user.shop_id == shop.id:
            return jsonify({"message": "既にこの店舗に所属しています", "shop_id": shop.id}), 200
        # 別の店舗に所属している場合、スタッフは上書きで所属を変更する
        # 管理者はこの API は使わへんけど、念のためロールチェックはせん
        
    user.shop_id = shop.id
    
    # 4. セッション情報も店舗名とIDで更新
    session["shop_id"] = shop.id
    session["shop_name"] = shop.name
    
    db.session.commit()
    
    return jsonify({"message": f"店舗 '{shop.name}' に参加しました！", "shop_id": shop.id})

# -------------------- API: セッション取得 --------------------
@app.route("/api/session")
def get_session():
    if "user_id" in session:
        return jsonify({
            "user": {
                "user_name": session.get("user_name"),
                "role": session.get("role"),
                "shop_name": session.get("shop_name"),
                "shop_id": session.get("shop_id")
            }
        })
    return jsonify({"user": None})



if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

