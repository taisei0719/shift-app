# backend/services/rejection_history.py
# スタッフごとのシフト希望採用/棄却の累積履歴。shiftsドメイン・auto_adjustドメイン・
# rejection_historyドメインの複数から使われる。

from datetime import datetime

from models import db, ShiftRejectionHistory


def get_current_year_month():
    """現在の年月を 'YYYY-MM' 形式で返す"""
    return datetime.now().strftime('%Y-%m')


def get_or_create_history(user_id: int, shop_id: int) -> ShiftRejectionHistory:
    """
    (user_id, shop_id) に対応する履歴レコードを取得または新規作成する。
    reset_mode='monthly' の場合、月が変わっていれば自動リセットする。
    """
    history = ShiftRejectionHistory.query.filter_by(
        user_id=user_id,
        shop_id=shop_id
    ).first()

    if not history:
        # 初回: 新規作成
        history = ShiftRejectionHistory(
            user_id=user_id,
            shop_id=shop_id,
            total_requests=0,
            total_accepted=0,
            reset_mode='manual',
            last_reset_year_month=get_current_year_month()
        )
        db.session.add(history)
        return history

    # 月次リセットチェック
    if history.reset_mode == 'monthly':
        current_ym = get_current_year_month()
        if history.last_reset_year_month != current_ym:
            # 月が変わっていたらリセット
            history.total_requests = 0
            history.total_accepted = 0
            history.last_reset_year_month = current_ym

    return history


def update_rejection_histories(shop_id: int, date, request_shifts, accepted_user_ids: set):
    """
    シフト確定時に棄却履歴を更新する。

    Args:
        shop_id: 対象店舗ID
        date: 対象日付
        request_shifts: その日の全リクエストシフトのリスト
        accepted_user_ids: 採用されたユーザーIDのset
    """
    # その日に希望を提出したユーザーIDを収集
    requesting_user_ids = {s.user_id for s in request_shifts}

    for user_id in requesting_user_ids:
        history = get_or_create_history(user_id, shop_id)
        history.total_requests += 1
        if user_id in accepted_user_ids:
            history.total_accepted += 1
        # updated_at は onupdate で自動更新される
