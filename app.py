from flask import Flask, render_template, request, redirect, url_for
import sqlite3

app = Flask(__name__)
DB = "shifts.db"

# DB初期化
def init_db():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time_slot TEXT,
            name TEXT,
            available INTEGER
        )
    ''')
    conn.commit()
    conn.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/input", methods=["GET", "POST"])
def input_shift():
    if request.method == "POST":
        date = request.form["date"]
        time_slot = request.form["time_slot"]
        name = request.form["name"]
        available = 1 if request.form.get("available") else 0

        conn = sqlite3.connect(DB)
        c = conn.cursor()
        c.execute("INSERT INTO shifts (date,time_slot,name,available) VALUES (?,?,?,?)",
                  (date,time_slot,name,available))
        conn.commit()
        conn.close()
        return redirect(url_for("show_shifts"))
    return render_template("input.html")

@app.route("/shifts")
def show_shifts():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute("SELECT date,time_slot,name,available FROM shifts")
    data = c.fetchall()
    conn.close()
    return render_template("shifts.html", data=data)

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
