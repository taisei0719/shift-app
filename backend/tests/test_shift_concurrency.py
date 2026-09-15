from unittest.mock import patch

import app as app_module
from blueprints import shifts as shifts_module


def test_confirm_shifts_returns_409_on_lock_conflict(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="lockadmin1@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="lockstaff1@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    admin_headers = auth_header("lockadmin1@example.com", "password123")

    with patch.object(shifts_module, "acquire_shop_shift_lock", side_effect=shifts_module.ShiftLockConflict()):
        res = client.post(
            "/api/admin/shifts/confirm",
            headers=admin_headers,
            json={
                "confirmed_shifts": [
                    {
                        "user_id": staff_id,
                        "shift_date": "2026-10-01",
                        "start_time": "09:00",
                        "end_time": "17:00",
                    }
                ]
            },
        )

    assert res.status_code == 409
    assert "他の管理者" in res.get_json()["error"]


def test_auto_adjust_apply_returns_409_on_lock_conflict(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="lockadmin2@example.com", password="password123", role="admin", shop=shop)
    admin_headers = auth_header("lockadmin2@example.com", "password123")

    with patch.object(app_module, "acquire_shop_shift_lock", side_effect=app_module.ShiftLockConflict()):
        res = client.post(
            "/api/admin/shifts/auto_adjust/2026-10-01",
            headers=admin_headers,
            json={"apply": True},
        )

    assert res.status_code == 409
    assert "他の管理者" in res.get_json()["error"]


def test_auto_adjust_simulation_does_not_acquire_lock(client, make_shop, make_user, auth_header):
    """apply=falseのシミュレーションはロックを取得せず、競合の影響を受けない。"""
    shop = make_shop()
    make_user(email="lockadmin3@example.com", password="password123", role="admin", shop=shop)
    admin_headers = auth_header("lockadmin3@example.com", "password123")

    with patch.object(app_module, "acquire_shop_shift_lock", side_effect=app_module.ShiftLockConflict()) as mocked_lock:
        res = client.post(
            "/api/admin/shifts/auto_adjust/2026-10-01",
            headers=admin_headers,
            json={"apply": False},
        )

    assert res.status_code == 200
    mocked_lock.assert_not_called()
