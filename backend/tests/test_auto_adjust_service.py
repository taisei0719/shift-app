# backend/tests/test_auto_adjust_service.py
# services/auto_adjust.py の compute_auto_assignments に関する単体テスト。

from datetime import date, time

from models import Shift
from services.auto_adjust import compute_auto_assignments


def test_compute_auto_assignments_rejects_zero_duration_shift(app, make_shop, make_user, db_session):
    """end_time <= start_time（所要時間ゼロ）のシフト希望は、hoursが空リストになり
    all()が空リストに対してTrueを返すことで定員チェックをすり抜けて割当されてしまう
    バグの回帰テスト（issue #109レビュー対応）。"""
    shop = make_shop()
    staff = make_user(email="zeroduration@example.com", role="staff", shop=shop)

    shift = Shift(
        user_id=staff.id,
        shop_id=shop.id,
        shift_date=date(2026, 10, 1),
        start_time=time(10, 0),
        end_time=time(10, 0),  # 所要時間ゼロ（本来想定しない入力だが防御的に検証する）
        shift_type="request",
    )
    db_session.add(shift)
    db_session.commit()

    assignments, _ = compute_auto_assignments([shift], {}, {})

    assert assignments == []
