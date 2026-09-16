# backend/blueprints/shifts.py
# シフト希望提出・確定・取得関連エンドポイント（PBI #40 / SBI #75）

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta, date

from models import db, User, Shift
from services.shift_lock import ShiftLockConflict, acquire_shop_shift_lock
from services.rejection_history import get_or_create_history

shifts_bp = Blueprint("shifts", __name__)


# -------------------- API: シフト提出  --------------------
@shifts_bp.route("/api/shifts/submit_request", methods=["POST"])
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

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    submitted_requests = data.get("requests", [])

    if not isinstance(submitted_requests, list) or not submitted_requests:
        return jsonify({"error": "シフトデータがありません"}), 400
    if not all(isinstance(r, dict) for r in submitted_requests):
        return jsonify({"error": "シフトデータの形式が不正です"}), 400

    # 提出されたリクエストは全て同じ日付のはずなので、最初のエントリから日付を取得
    date_str = submitted_requests[0].get("date")
    if not isinstance(date_str, str):
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

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

        # Shiftモデルにデータを格納（提出時点のUser.positionをスナップショットする）
        new_shift = Shift(
            user_id=user_id,
            shop_id=shop_id,
            shift_date=target_date,
            start_time=start_time_obj,
            end_time=end_time_obj,
            shift_type='request', # 希望として登録
            position=user.position,
        )
        db.session.add(new_shift)
        new_request_count += 1

    db.session.commit()

    return jsonify({"message": f"日付 {date_str} のシフト希望を{new_request_count}件登録しました！"})


# -------------------- API: 指定年月の店舗別シフト状況取得 (Admin専用) --------------------
@shifts_bp.route("/api/admin/shifts/status/<int:year>/<int:month>", methods=["GET"])
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
@shifts_bp.route("/api/admin/shifts/<date_str>", methods=["GET"])
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
@shifts_bp.route("/api/admin/shifts/confirm", methods=["POST"])
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

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    confirmed_shifts_data = data.get("confirmed_shifts", [])

    if not isinstance(confirmed_shifts_data, list) or not confirmed_shifts_data:
        return jsonify({"error": "確定シフトデータがありません"}), 400

    try:
        acquire_shop_shift_lock(shop_id)
    except ShiftLockConflict:
        return jsonify({"error": "他の管理者がシフト確定処理中です。しばらくしてから再度お試しください。"}), 409

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
        # 自動調整の定員チェックはリクエスト提出時点のpositionを基準に行われているため、
        # 確定シフトのpositionもリクエスト時点のものを優先して引き継ぐ（削除前に退避しておく）
        request_position_by_user = {
            s.user_id: s.position for s in shifts_to_delete if s.shift_type == 'request'
        }
        for shift in shifts_to_delete:
            db.session.delete(shift)
        db.session.flush()  # commit()にするとロックが解放されてしまうため、flush()で反映のみ行う

        # 新しい確定シフトを追加
        # 他店舗のユーザーのpositionが紛れ込まないよう、shop_idでスコープする
        users_by_id = {
            u.id: u for u in User.query.filter(
                User.id.in_(target_user_ids),
                User.shop_id == shop_id,
            ).all()
        }
        new_confirmed_shifts = []
        accepted_user_ids = set()

        for shift_data in confirmed_shifts_data:
            if 'user_id' not in shift_data or 'start_time' not in shift_data or 'end_time' not in shift_data:
                continue

            # user_idがadminの店舗に実在しない場合（他店舗のユーザー・存在しないID等）は
            # 不整合なShiftレコードを作らないようスキップする
            target_user = users_by_id.get(shift_data['user_id'])
            if not target_user:
                continue

            start_time_obj = datetime.strptime(shift_data['start_time'], '%H:%M').time()
            end_time_obj = datetime.strptime(shift_data['end_time'], '%H:%M').time()

            # 対応するリクエストがあればそのpositionを引き継ぎ（定員チェックとの整合性を保つ）、
            # なければ現時点でのUser.positionをスナップショットする
            if shift_data['user_id'] in request_position_by_user:
                position = request_position_by_user[shift_data['user_id']]
            else:
                position = target_user.position

            new_shift = Shift(
                user_id=shift_data['user_id'],
                shop_id=shop_id,
                shift_date=target_date,
                start_time=start_time_obj,
                end_time=end_time_obj,
                position=position,
                shift_type='confirmed'
            )
            db.session.add(new_shift)
            new_confirmed_shifts.append(new_shift)
            accepted_user_ids.add(shift_data['user_id'])

        # ★ 棄却履歴の更新
        # リクエストを提出していた全ユーザーに対してカウントを更新
        for uid in all_requesting_user_ids:
            history = get_or_create_history(uid, shop_id)
            history.total_requests += 1
            if uid in accepted_user_ids:
                history.total_accepted += 1

        db.session.commit()
        return jsonify({"message": f"日付 {date_str} のシフトを{len(new_confirmed_shifts)}件確定しました。"}), 200

    except Exception:
        db.session.rollback()
        current_app.logger.exception("シフト確定処理中にエラーが発生しました")
        return jsonify({"error": "シフト確定処理中にエラーが発生しました"}), 500


# -------------------- API: 指定日の自分の確定シフト取得 (Staff/Admin 向け) --------------------
@shifts_bp.route("/api/shifts/<date_str>", methods=["GET"])
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
@shifts_bp.route("/api/shifts/month/<int:year>/<int:month>", methods=["GET"])
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
