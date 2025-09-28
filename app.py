from flask import Flask, render_template, request, redirect, url_for, session
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.secret_key = "secret_key"
DB = "shifts.db"

def init_db():
    conn = get_db()
    c = conn.cursor()
    # usersテーブル
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            role TEXT,
            password TEXT
        )
    ''')
    # shift_requestsテーブル（日付単位）
    c.execute('''
        CREATE TABLE IF NOT EXISTS shift_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    # shiftsテーブル（時間帯）
    c.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shift_request_id INTEGER NOT NULL,
            time_slot TEXT NOT NULL,
            FOREIGN KEY(shift_request_id) REFERENCES shift_requests(id)
        )
    ''')
    conn.commit()
    conn.close()

# -------------------- DB接続 --------------------
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

# -------------------- テストユーザー追加 --------------------
def add_test_users():
    conn = get_db()
    c = conn.cursor()
    # 管理者アカウント
    c.execute("INSERT OR IGNORE INTO users (id, name, role, password) VALUES (1,'admin','admin','pass')")
    # スタッフアカウント（テスト用）
    c.execute("INSERT OR IGNORE INTO users (id, name, role, password) VALUES (2,'yamada','staff','pass')")
    c.execute("INSERT OR IGNORE INTO users (id, name, role, password) VALUES (3,'sato','staff','pass')")
    c.execute("INSERT OR IGNORE INTO users (id, name, role, password) VALUES (4,'suzuki','staff','pass')")
    conn.commit()
    conn.close()

# -------------------- ログイン --------------------
@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        name = request.form["name"]
        password = request.form["password"]
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE name=? AND password=?", (name,password))
        user = c.fetchone()
        conn.close()
        if user:
            session["user_id"] = user["id"]
            session["role"] = user["role"]
            if user["role"] == "admin":
                return redirect(url_for("admin"))
            else:
                return redirect(url_for("staff"))
    return render_template("login.html")

# -------------------- 管理者トップ（カレンダー表示） --------------------
@app.route("/admin")
def admin():
    if session.get("role") != "admin":
        return "アクセス権限がありません"

    # 今月を表示
    today = datetime.today()
    year, month = today.year, today.month

    # カレンダー生成
    import calendar
    cal = calendar.Calendar()
    days = list(cal.itermonthdates(year, month))

    return render_template("admin_calendar.html", days=days, year=year, month=month)

# -------------------- 日付別のシフト確認 --------------------
@app.route("/admin/<date>")
@app.route("/admin/shift_day/<date>")
def admin_day(date):
    if session.get("role") != "admin":
        return "アクセス権限がありません"

    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT u.name, s.time_slot
        FROM shift_requests sr
        JOIN users u ON sr.user_id = u.id
        JOIN shifts s ON sr.id = s.shift_request_id
        WHERE sr.date=?
        ORDER BY u.name, s.time_slot
    """, (date,))
    rows = c.fetchall()
    conn.close()

    # 名前ごとの時間帯リストに変換
    schedule = {}
    for row in rows:
        if row["name"] not in schedule:
            schedule[row["name"]] = []
        schedule[row["name"]].append(row["time_slot"])

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

    if request.method=="POST":
        user_id = session["user_id"]
        date = request.form["date"]
        start_time = request.form["start_time"]
        end_time = request.form["end_time"]

        conn = get_db()
        c = conn.cursor()

        # 日付単位で shift_requests に登録
        c.execute("INSERT INTO shift_requests (user_id, date) VALUES (?, ?)", (user_id, date))
        shift_request_id = c.lastrowid

        # 30分刻みで shifts に時間帯を登録
        h, m = map(int, start_time.split(":"))
        while True:
            t = f"{h:02d}:{m:02d}"
            c.execute("INSERT INTO shifts (shift_request_id, time_slot) VALUES (?, ?)", (shift_request_id, t))

            # 30分刻みで加算
            if m == 0:
                m = 30
            else:
                m = 0
                h += 1
            if f"{h:02d}:{m:02d}" == end_time:
                break

        conn.commit()
        conn.close()
        return redirect(url_for("staff"))

    return render_template("shift_input.html")

if __name__ == "__main__":
    init_db()
    add_test_users()
    app.run(debug=True)
