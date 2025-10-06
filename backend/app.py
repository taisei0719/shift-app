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
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, origins=[FRONTEND_URL], supports_credentials=True)

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
        return jsonify({"error": "そのメールアドレスは既に登録済み"}), 400

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
    if user and check_password_hash(user.password, password):
        session["user_id"] = user.id
        session["role"] = user.role
        return jsonify({"message": "ログイン成功", "user_id": user.id, "role": user.role})
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
        return jsonify({"error": "ログインが必要"}), 401

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
    if session.get("role") != "admin":
        return jsonify({"error": "権限なし"}), 403

    data = request.json
    name = data.get("name")
    location = data.get("location")

    if Shop.query.filter_by(name=name).first():
        return jsonify({"error": "店舗名が既に存在"}), 400

    code = generate_shop_code()
    shop = Shop(name=name, location=location, shop_code=code)
    db.session.add(shop)
    db.session.commit()
    return jsonify({"message": "店舗登録成功", "shop_code": code})

# -------------------- API: シフト取得 --------------------
@app.route("/api/shifts/<date>", methods=["GET"])
def get_shifts(date):
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要"}), 401

    user = User.query.get(session["user_id"])
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

if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

