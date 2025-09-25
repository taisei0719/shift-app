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
    # shift_requestsテーブル
    c.execute('''
        CREATE TABLE IF NOT EXISTS shift_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            time_slot TEXT,
            available INTEGER
        )
    ''')
    # shiftsテーブル（管理者公開用）
    c.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time_slot TEXT,
            user_id INTEGER
        )
    ''')
    conn.commit()
    conn.close()


# -------------------- DB接続 --------------------
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

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

# -------------------- 管理者画面 --------------------
@app.route("/admin")
def admin():
    if session.get("role") != "admin":
        return "アクセス権限がありません"
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM shift_requests")
    requests = c.fetchall()
    conn.close()
    return render_template("admin.html", requests=requests)

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
        time_slot = request.form["time_slot"]
        available = 1 if request.form.get("available") else 0
        conn = get_db()
        c = conn.cursor()
        c.execute("INSERT INTO shift_requests (user_id,date,time_slot,available) VALUES (?,?,?,?)",
                  (user_id,date,time_slot,available))
        conn.commit()
        conn.close()
        return redirect(url_for("staff"))
    return render_template("shift_input.html")



if __name__ == "__main__":
    init_db()
    app.run(debug=True)
