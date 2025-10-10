# frontend/app.py


import os
from flask import Flask, request, jsonify, session
#from .models import db, User, Shop, Shift
from models import db, User, Shop, Shift
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, date
import random, string
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", "your_strong_secret_key_here")  

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///shifts.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

CORS(
    app, 
    resources={r"/api/*": {"origins": "http://localhost:3000"}},
    supports_credentials=True, # クッキー/セッション情報を送受信するために必要
    allow_headers=["Content-Type", "Authorization"] # 通常使用するヘッダーを許可
) 

# -------------------- DB初期化 --------------------
def init_db():
    with app.app_context():
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

# -------------------- API: アカウント情報編集 --------------------
@app.route("/api/account/edit", methods=["POST"])
def edit_account():
    # 1. ログインチェック
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "ログインが必要です"}), 401

    data = request.json
    new_name = data.get("name")
    new_email = data.get("email")
    new_password = data.get("password") # パスワードは変更する場合のみ

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    # 2. 名前の更新
    if new_name:
        user.name = new_name
        session["user_name"] = new_name # セッションも更新

    # 3. メールの更新と重複チェック
    if new_email and new_email != user.email:
        # 他のユーザーが既にそのメールアドレスを使っていないかチェック
        if User.query.filter_by(email=new_email).first():
            return jsonify({"error": "そのメールアドレスは既に使用されています"}), 400
        user.email = new_email

    # 4. パスワードの更新
    if new_password:
        user.password = generate_password_hash(new_password)

    db.session.commit()
    
    # 5. フロントエンドに返す情報 (リフレッシュ用にユーザー名などを返す必要はないけど、メッセージを返す)
    return jsonify({"message": "アカウント情報を更新しました"}), 200


# -------------------- API: アカウント削除 --------------------
@app.route("/api/account/delete", methods=["POST"])
def delete_account():
    # 1. ログインチェック
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "ログインが必要です"}), 401
    
    # 2. ユーザーオブジェクトを取得
    user = db.session.get(User, user_id)
    if not user:
        # DBにユーザーがいなくてもセッションは消す
        session.clear() 
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    try:
        # 3. 関連データの削除 (ShiftRequest関連の削除コードを削除し、Shiftを直接削除)
        # ユーザーに紐づく全ての Shift を削除
        Shift.query.filter_by(user_id=user.id).delete(synchronize_session='fetch')
        
        for sr in shift_requests:
            # ShiftRequestに紐づく Shift も削除
            Shift.query.filter_by(shift_request_id=sr.id).delete()
            # ShiftRequest 本体を削除
            db.session.delete(sr)

        # ★ 4. ユーザーアカウント本体の削除
        db.session.delete(user)
        
        # 5. セッション情報のクリア
        session.clear()
        
        db.session.commit()
        return jsonify({"message": "アカウントを正常に削除しました"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"アカウント削除エラー: {e}")
        return jsonify({"error": "アカウントの削除中にエラーが発生しました"}), 500

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

# -------------------- API: シフト提出 (複数対応版) --------------------
# ★ 修正1: エンドポイント名をフロントと合わせ、POSTメソッドを確保
@app.route("/api/shifts/submit_request", methods=["POST"]) 
def submit_shift_request():
    user_id = session.get("user_id")
    shop_id = session.get("shop_id") # 所属店舗IDも取得
    
    # 1. ログイン/所属店舗チェック
    if not user_id:
        return jsonify({"error": "ログインが必要です"}), 401
    if not shop_id:
        return jsonify({"error": "店舗に所属していません"}), 400

    data = request.json
    # フロントエンドは { requests: [{date, start, end}, ...] } の形式で送ってくる
    submitted_requests = data.get("requests", []) 

    if not submitted_requests:
        return jsonify({"error": "シフトデータがありません"}), 400

    # 提出されたリクエストは全て同じ日付のはずなので、最初のエントリから日付を取得
    # フロントエンドから YYYY-MM-DD 形式の文字列が来ることを期待
    date_str = submitted_requests[0].get("date") 
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 2. 同じ日の既存の 'request' シフトを全て削除 (上書き提出と見なす)
    # ★ 修正2: ShiftRequestモデルを使わず、Shiftモデルの'request'タイプを削除
    Shift.query.filter(
        Shift.user_id == user_id, 
        Shift.shift_date == target_date,
        Shift.shift_type == 'request'
    ).delete(synchronize_session='fetch')
    
    # 3. 新しいシフト希望を全て Shift モデルに登録
    new_request_count = 0
    
    for req_data in submitted_requests:
        # フロントからは start/end で来るため、キー名を修正
        start_time_str = req_data.get("start")
        end_time_str = req_data.get("end")

        # 時間が空欄（例: "00:00"）の場合はスキップ (フロント側でフィルタ済みだが念のため)
        if not start_time_str or start_time_str == "00:00" or not end_time_str or end_time_str == "00:00":
             continue
        
        try:
            start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
            end_time_obj = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
             # 不正な時間形式はスキップ
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

# -------------------- API: 指定日のシフト一覧取得/調整用 (Admin専用) --------------------
@app.route("/api/admin/shifts/<date_str>", methods=["GET"])
def get_shifts_for_admin(date_str):
    user_id = session.get("user_id")
    shop_id = session.get("shop_id")
    
    # 1. ログイン/権限/所属店舗チェック
    if not user_id or session.get("role") != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    try:
        # 2. 日付を datetime.date オブジェクトに変換
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 3. 自分の店舗の、指定日における全てのシフトを取得
    # shift_type が 'request' または 'confirmed' のシフトを取得
    shifts_data = Shift.query.filter(
        Shift.shop_id == shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type.in_(['request', 'confirmed']) # 希望と確定済みの両方を取得
    ).all()
    
    # 4. ユーザーごとにデータを整理
    # {user_id: {name: "...", requests: [], confirmed: []}}
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
            
        shift_info = shift.to_dict() # Shiftモデルのto_dict()を使用
        
        if shift.shift_type == 'request':
            staff_data[user_id_key]['requests'].append(shift_info)
        elif shift.shift_type == 'confirmed':
            staff_data[user_id_key]['confirmed'].append(shift_info)

    return jsonify({"staff_shifts": list(staff_data.values())}), 200

# backend/app.py に追加するコード

# -------------------- API: シフト確定・手動調整 (Admin専用) --------------------
@app.route("/api/admin/shifts/confirm", methods=["POST"])
def confirm_shifts():
    user_id = session.get("user_id")
    shop_id = session.get("shop_id")
    
    # 1. ログイン/権限/所属店舗チェック
    if not user_id or session.get("role") != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    data = request.json
    confirmed_shifts_data = data.get("confirmed_shifts", [])
    
    if not confirmed_shifts_data:
        return jsonify({"error": "確定シフトデータがありません"}), 400
        
    try:
        # データから日付を取得（全て同じ日付のはず）
        date_str = confirmed_shifts_data[0]['shift_date']
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        target_user_ids = [shift['user_id'] for shift in confirmed_shifts_data]
        
        # 削除対象の確定シフトを読み込む
        shifts_to_delete = Shift.query.filter(
            Shift.shop_id == shop_id,
            Shift.shift_date == target_date,
            # Shift.shift_type == 'confirmed',
            # 今回確定処理を行うユーザーの分だけを対象にする
            Shift.user_id.in_(target_user_ids) 
        ).all()
        
        # 読み込んだオブジェクトを一つずつ削除
        for shift in shifts_to_delete:
            db.session.delete(shift)
        
        # ここで削除をDBに確定させる（これが重要！）
        db.session.commit()

        new_confirmed_shifts = []
        
        inserted_user_dates = set()
        
        # 3. 新しい確定シフトをDBに追加
        for shift_data in confirmed_shifts_data:
            user_id_to_add = shift_data.get('user_id')
            date_to_add = shift_data.get('shift_date') # target_date と同じだが念のため
            
            # 入力チェック (user_id, start_time, end_time が必須)
            if 'user_id' not in shift_data or 'start_time' not in shift_data or 'end_time' not in shift_data:
                 continue # 不正なデータはスキップ
             
            key = (user_id_to_add, date_to_add)
            
            inserted_user_dates.add(key)

            start_time_obj = datetime.strptime(shift_data['start_time'], '%H:%M').time()
            end_time_obj = datetime.strptime(shift_data['end_time'], '%H:%M').time()
            
            new_shift = Shift(
                user_id=shift_data['user_id'],
                shop_id=shop_id,
                shift_date=target_date,
                start_time=start_time_obj,
                end_time=end_time_obj,
                shift_type='confirmed' # 確定済みとして登録
            )
            db.session.add(new_shift)
            new_confirmed_shifts.append(new_shift)

        db.session.commit()
        return jsonify({"message": f"日付 {date_str} のシフトを{len(new_confirmed_shifts)}件確定しました。"}), 200

    except Exception as e:
        db.session.rollback()
        db.session.remove()
        print(f"シフト確定エラー: {e}")
        return jsonify({"error": f"シフト確定処理中にエラーが発生しました: {str(e)}"}), 500
    
# -------------------- API: 指定日の自分の確定シフト取得 (Staff/Admin 向け) --------------------
@app.route("/api/shifts/<date_str>", methods=["GET"])
def get_shifts(date_str):
    user_id = session.get("user_id")
    
    # 1. ログインチェック
    if not user_id:
        return jsonify({"error": "ログインが必要です"}), 401

    # 2. ユーザー情報の取得と店舗チェック
    user = db.session.get(User, user_id)
    if not user or not user.shop_id:
        # Userが見つからない、またはshop_idがNoneの場合
        return jsonify({"error": "ユーザー情報が見つからないか、所属店舗が登録されていません"}), 400
    
    shop_id = user.shop_id

    try:
        # 3. 日付変換
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    # 4. 自分の確定シフトのみを取得 (Shift モデルを使用)
    # user_id、shop_id、日付、shift_type='confirmed' でフィルタ
    shifts = Shift.query.filter(
        Shift.user_id == user_id,
        Shift.shop_id == shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type == 'confirmed' # ★ 確定シフトのみを取得
    ).all()

    # 5. レスポンス整形
    if not shifts:
        # 確定シフトがない場合は空のリストとメッセージを返す
        return jsonify({"message": f"{date_str} の確定シフトはありません。", "confirmed_shifts": []}), 200

    confirmed_shifts_list = [shift.to_dict() for shift in shifts]

    return jsonify({"confirmed_shifts": confirmed_shifts_list}), 200

# -------------------- API: 指定年月の自分の全シフト取得 (Staff/Admin 向け) --------------------
@app.route("/api/shifts/month/<int:year>/<int:month>", methods=["GET"])
def get_user_shifts_by_month(year, month):
    user_id = session.get("user_id")
    
    # 1. ログインチェック
    if not user_id:
        return jsonify({"error": "ログインが必要です"}), 401

    # 2. ユーザー情報と店舗IDの取得
    user = db.session.get(User, user_id)
    if not user or not user.shop_id:
        return jsonify({"error": "ユーザー情報が見つからないか、所属店舗が登録されていません"}), 400
    
    shop_id = user.shop_id

    try:
        # 3. 期間の計算
        start_date = date(year, month, 1)
        # 翌月1日の前日 = 今月の最終日
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
            
    except ValueError:
        return jsonify({"error": "年月の指定が不正です"}), 400

    # 4. 自分の全シフト（希望/確定）を取得
    # shift_date が期間内、かつ shift_type が 'request' または 'confirmed' のものを取得
    shifts = Shift.query.filter(
        Shift.user_id == user_id,
        Shift.shop_id == shop_id,
        Shift.shift_date >= start_date,
        Shift.shift_date <= end_date,
        Shift.shift_type.in_(['request', 'confirmed']) # 希望と確定の両方
    ).all()

    # 5. レスポンス整形
    if not shifts:
        return jsonify({"message": f"{year}年{month}月のシフトはありません。", "shifts_by_date": {}}), 200

    # 日付ごとの辞書に格納 { "2025-10-01": [shift_dict, ...], ... }
    # フロントエンドでカレンダーにマッピングしやすいように整形
    shifts_by_date = {}
    for shift in shifts:
        date_key = shift.shift_date.strftime('%Y-%m-%d')
        if date_key not in shifts_by_date:
            shifts_by_date[date_key] = []
        
        # Shiftモデルのto_dict()を使用し、時と分のデータがフロントエンドに送られるようにする
        shifts_by_date[date_key].append(shift.to_dict()) 

    return jsonify({"shifts_by_date": shifts_by_date}), 200

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

    code = Shop.generate_unique_code() # ★ 修正: クラスメソッドを使用
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

# -------------------- API: 店舗参加リクエスト --------------------
@app.route('/api/join_shop/request', methods=['POST'])
def join_shop_request():
    data = request.get_json()
    shop_code = data.get('shop_code')
    
    if "user_id" not in session:
        return jsonify({"error": "ログインが必要です"}), 401
    
    user = db.session.get(User, session["user_id"])
    if user.shop_id:
        return jsonify({"error": "既に店舗に所属しています"}), 400

    # 1. 店舗コードの検証
    shop = Shop.query.filter_by(shop_code=shop_code).first()
    if not shop:
        return jsonify({"error": "無効な店舗コードです"}), 404

    # 2. リクエスト送信（Userモデルの暫定カラムを更新）
    # ※ 本来はリクエストテーブルを別に作り、オーナーに通知する必要がある
    user.shop_request_code = shop_code # 暫定的なリクエスト状態
    db.session.commit()

    return jsonify({"message": f"店舗 '{shop.name}' への参加リクエストをオーナーに送信しました。"}), 200
    
    # -------------------- API: 参加リクエスト一覧取得 (Admin専用) --------------------
@app.route("/api/join_requests", methods=["GET"])
def get_join_requests():
    # 1. ログインチェックと権限チェック
    user_id = session.get("user_id")
    if not user_id or session.get("role") != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403

    admin_user = db.session.get(User, user_id)
    shop_id = admin_user.shop_id
    
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    # 2. 自分の店舗コードを取得
    shop = db.session.get(Shop, shop_id)
    if not shop:
        return jsonify({"error": "店舗が見つかりません"}), 404
    
    target_code = shop.shop_code

    # 3. その店舗コードでリクエスト中のユーザーを全て検索
    # User.shop_id が None で、shop_request_code が自分の店舗コードと一致するユーザー
    requests = User.query.filter(
        User.shop_id == None, 
        User.shop_request_code == target_code
    ).all()
    
    # 4. JSON形式でリクエストユーザーの一覧を返す
    request_list = [{
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "request_date": "N/A" # 簡易版のため、リクエスト日時情報（未実装）はスキップ
    } for user in requests]

    return jsonify({"requests": request_list}), 200


# -------------------- API: 参加リクエスト承認/拒否 (Admin専用) --------------------
@app.route("/api/join_requests/<int:user_id>", methods=["POST"])
def handle_join_request(user_id):
    # 1. ログインチェックと権限チェック
    admin_id = session.get("user_id")
    if not admin_id or session.get("role") != "admin":
        return jsonify({"error": "管理者権限が必要です"}), 403

    data = request.json
    action = data.get("action") # 'approve' または 'reject'

    # 2. 対象ユーザーを取得
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "対象ユーザーが見つかりません"}), 404

    # 3. アクションの実行
    if action == "approve":
        # 管理者自身の店舗IDと店舗名を取得
        admin_user = db.session.get(User, admin_id)
        
        # ★ 承認処理: user.shop_id を設定し、リクエストコードをクリア
        target_user.shop_id = admin_user.shop_id
        target_user.shop_request_code = None
        message = f"ユーザー {target_user.name} を店舗に承認しました。"
    
    elif action == "reject":
        # ★ 拒否処理: リクエストコードのみをクリア
        target_user.shop_request_code = None
        message = f"ユーザー {target_user.name} の参加リクエストを拒否しました。"

    else:
        return jsonify({"error": "無効なアクションです"}), 400

    db.session.commit()
    return jsonify({"message": message}), 200

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

# -------------------- API: セッション取得 --------------------
@app.route("/api/session")
def get_session():
    if "user_id" in session:
        user_id = session.get("user_id")
        user_from_db = User.query.get(user_id) 

        if user_from_db:
            return jsonify({
                "user": {
                    "user_name": user_from_db.name,
                    "role": user_from_db.role,
                    "shop_name": session.get("shop_name"),
                    "shop_id": session.get("shop_id"),
                    "shop_request_code": user_from_db.shop_request_code
                }
            })
    return jsonify({"user": None})



if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)

