from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = "secret_key"

app.jinja_env.globals['datetime'] = datetime


# -------------------- データベース設定 --------------------
# 開発時 SQLite
DB_URI = "sqlite:///shifts.db"
# 本番用例（PostgreSQL）
# DB_URI = "postgresql://user:password@localhost/shifts"

app.config['SQLALCHEMY_DATABASE_URI'] = DB_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# -------------------- モデル定義 --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin or staff
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
    
# -------------------- DB 初期化 --------------------
def init_db():
    db.create_all()
    # テストユーザー追加
    if not User.query.filter_by(name='admin').first():
        admin = User(name='admin', email='admin@example.com', role='admin', password=generate_password_hash('pass'))
        db.session.add(admin)
    if not User.query.filter_by(name='yamada').first():
        staff1 = User(name='yamada', email='yamada@example.com', role='staff', password=generate_password_hash('pass'))
        staff2 = User(name='sato', email='sato@example.com', role='staff', password=generate_password_hash('pass'))
        staff3 = User(name='suzuki', email='suzuki@example.com', role='staff', password=generate_password_hash('pass'))
        db.session.add_all([staff1, staff2, staff3])
    db.session.commit()
    
# -------------------- 店舗コード生成関数 --------------------
def generate_shop_code():
    while True:
        code = ''.join(random.choices(string.digits, k=6))  # 6桁ランダム数字
        if not Shop.query.filter_by(shop_code=code).first():
            return code

# -------------------- ログアウト --------------------
@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))

# -------------------- ログイン --------------------
@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        identifier = request.form.get("identifier")
        password = request.form["password"]
        
        # 名前またはメールアドレスで検索
        user = User.query.filter(
            (User.name == identifier) | (User.email == identifier)
        ).first()
        
        if user and check_password_hash(user.password, password):
            session["user_id"] = user.id
            session["role"] = user.role
            session["user_name"] = user.name

            # 所属店舗名をセッションに保存（あれば）
            if user.shop_id:
                shop = Shop.query.get(user.shop_id)
                session["shop_name"] = shop.name if shop else "未所属"
            else:
                session["shop_name"] = "未所属"

            if user.role == "admin":
                return redirect(url_for("admin"))
            else:
                return redirect(url_for("staff"))
            
        flash("ユーザー名かパスワードが違います")
    return render_template("login.html")

# -------------------- ユーザー登録 --------------------
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]
        role = request.form["role"]  

        # 同じ名前のユーザーがいないか確認
        if User.query.filter_by(email=email).first():
            flash("そのメールアドレスはすでに使われています")
            return redirect(url_for("register"))

        # ハッシュ化して保存
        new_user = User(
            name=name,
            email=email,
            password=generate_password_hash(password),
            role=role
        )
        db.session.add(new_user)
        db.session.commit()
        flash("登録完了しました。ログインしてください")
        return redirect(url_for("login"))

    return render_template("register.html")

# -------------------- 店舗登録画面 --------------------
@app.route("/admin/shop_register", methods=["GET", "POST"])
def shop_register():
    if session.get("role") != "admin":
        return "アクセス権限がありません"

    if request.method == "POST":
        name = request.form["name"]
        location = request.form["location"]

        if Shop.query.filter_by(name=name).first():
            flash("その店舗名は既に登録されています")
            return redirect(url_for("shop_register"))

        shop_code = generate_shop_code()
        shop = Shop(name=name, location=location, shop_code=shop_code)
        db.session.add(shop)
        db.session.commit()
        flash(f"店舗登録が完了しました。店舗ID: {shop_code}")
        return redirect(url_for("shop_register"))

    return render_template("shop_register.html")

# -------------------- スタッフ店舗登録画面 --------------------
@app.route("/staff/shop_register", methods=["GET", "POST"])
def staff_shop_register():
    if session.get("role") != "staff":
        return "アクセス権限がありません"

    if request.method == "POST":
        code = request.form["shop_code"]
        shop = Shop.query.filter_by(shop_code=code).first()
        if not shop:
            flash("無効な店舗IDです")
            return redirect(url_for("staff_shop_register"))

        user = User.query.get(session["user_id"])
        user.shop_id = shop.id
        db.session.commit()
        flash(f"{shop.name} に登録されました")
        return redirect(url_for("staff"))

    return render_template("staff_shop_register.html")


# -------------------- 管理者トップ（カレンダー表示） --------------------
@app.route("/admin")
@app.route("/admin/<int:year>/<int:month>")
def admin(year=None, month=None):
    if session.get("role") != "admin":
        return "アクセス権限がありません"

    import calendar
    today = datetime.today()

    # URLで指定なければ今月を表示
    if year is None or month is None:
        year, month = today.year, today.month

    cal = calendar.Calendar()
    days = list(cal.itermonthdates(year, month))

    # 前月・翌月の計算
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1

    return render_template(
        "admin_calendar.html",
        days=days,
        year=year,
        month=month,
        prev_year=prev_year,
        prev_month=prev_month,
        next_year=next_year,
        next_month=next_month
    )


# -------------------- 日付別のシフト確認（SQLAlchemy版） --------------------
@app.route("/admin/shift_day/<date>")
def admin_day(date):
    if session.get("role") != "admin":
        return "アクセス権限がありません"

    # ShiftRequest と Shift を結合して取得
    shift_requests = (
        ShiftRequest.query
        .filter_by(date=date)
        .join(User)
        .join(Shift)
        .add_entity(User)
        .add_entity(Shift)
        .order_by(User.name, Shift.time_slot)
        .all()
    )

    schedule = {}
    for sr, user, shift in shift_requests:
        if user.name not in schedule:
            schedule[user.name] = []
        schedule[user.name].append(shift.time_slot)

    # シフトがゼロ件でも schedule を渡す
    return render_template("admin_day.html", date=date, schedule=schedule)




# -------------------- スタッフ画面 --------------------
@app.route("/staff")
def staff():
    if session.get("role") != "staff":
        return "アクセス権限がありません"
    return render_template("staff.html")

# -------------------- シフト提出 --------------------
@app.route("/shift_input", methods=["GET","POST"])
def shift_input():
    if session.get("role") != "staff":
        return "アクセス権限がありません"

    if request.method == "POST":
        user_id = session["user_id"]
        date = request.form["date"]
        start_time = request.form["start_time"]
        end_time = request.form["end_time"]
        
        # ShiftRequest レコードを作成
        shift_request = ShiftRequest(user_id=user_id, date=date)
        db.session.add(shift_request)
        db.session.commit()  # ID を取得するために commit
        
        # Shift レコードを作成
        shift = Shift(shift_request_id=shift_request.id, time_slot=f"{start_time}-{end_time}")
        db.session.add(shift)
        db.session.commit()
        
        flash("シフトを提出しました")
        return redirect(url_for("staff"))

    return render_template("shift_input.html")

if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)
