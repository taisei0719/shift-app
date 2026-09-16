from models import ShiftRejectionHistory


def test_get_rejection_history_returns_shop_histories(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="rhadmin1@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="rhstaff1@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("rhadmin1@example.com", "password123")

    history = ShiftRejectionHistory(
        user_id=staff_id, shop_id=shop_id, total_requests=4, total_accepted=1, reset_mode="manual"
    )
    db_session.add(history)
    db_session.commit()

    res = client.get(f"/api/shop/{shop_id}/rejection_history", headers=admin_headers)

    assert res.status_code == 200
    histories = res.get_json()["histories"]
    assert len(histories) == 1
    assert histories[0]["user_id"] == staff_id
    assert histories[0]["total_requests"] == 4
    assert histories[0]["total_accepted"] == 1


def test_get_rejection_history_requires_admin(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="rhstaff2@example.com", password="password123", role="staff", shop=shop)
    shop_id = shop.id
    headers = auth_header("rhstaff2@example.com", "password123")

    res = client.get(f"/api/shop/{shop_id}/rejection_history", headers=headers)

    assert res.status_code == 403


def test_reset_rejection_history_all(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="rhadmin2@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="rhstaff3@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("rhadmin2@example.com", "password123")

    history = ShiftRejectionHistory(
        user_id=staff_id, shop_id=shop_id, total_requests=5, total_accepted=2, reset_mode="manual"
    )
    db_session.add(history)
    db_session.commit()

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset",
        headers=admin_headers,
        json={"reset_type": "all"},
    )

    assert res.status_code == 200
    refreshed = ShiftRejectionHistory.query.filter_by(user_id=staff_id, shop_id=shop_id).first()
    assert refreshed.total_requests == 0
    assert refreshed.total_accepted == 0


def test_reset_rejection_history_single_user(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="rhadmin3@example.com", password="password123", role="admin", shop=shop)
    staff1 = make_user(email="rhstaff4@example.com", password="password123", role="staff", shop=shop)
    staff2 = make_user(email="rhstaff5@example.com", password="password123", role="staff", shop=shop)
    staff1_id, staff2_id = staff1.id, staff2.id
    shop_id = shop.id
    admin_headers = auth_header("rhadmin3@example.com", "password123")

    db_session.add_all([
        ShiftRejectionHistory(user_id=staff1_id, shop_id=shop_id, total_requests=3, total_accepted=1, reset_mode="manual"),
        ShiftRejectionHistory(user_id=staff2_id, shop_id=shop_id, total_requests=3, total_accepted=1, reset_mode="manual"),
    ])
    db_session.commit()

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset",
        headers=admin_headers,
        json={"reset_type": "user", "user_id": staff1_id},
    )

    assert res.status_code == 200
    reset_history = ShiftRejectionHistory.query.filter_by(user_id=staff1_id, shop_id=shop_id).first()
    untouched_history = ShiftRejectionHistory.query.filter_by(user_id=staff2_id, shop_id=shop_id).first()
    assert reset_history.total_requests == 0
    assert untouched_history.total_requests == 3


def test_reset_rejection_history_rejects_invalid_reset_type(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="rhadmin4@example.com", password="password123", role="admin", shop=shop)
    shop_id = shop.id
    admin_headers = auth_header("rhadmin4@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset",
        headers=admin_headers,
        json={"reset_type": "invalid"},
    )

    assert res.status_code == 400


def test_reset_rejection_history_rejects_non_object_body(client, make_shop, make_user, auth_header):
    """JSON配列などオブジェクト以外のボディは、data.get()呼び出し前に400で弾く（issue #109レビュー対応）。"""
    shop = make_shop()
    make_user(email="rhadmin7@example.com", password="password123", role="admin", shop=shop)
    shop_id = shop.id
    admin_headers = auth_header("rhadmin7@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset",
        headers=admin_headers,
        json=["not", "an", "object"],
    )

    assert res.status_code == 400


def test_update_reset_mode(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="rhadmin5@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="rhstaff6@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("rhadmin5@example.com", "password123")

    history = ShiftRejectionHistory(
        user_id=staff_id, shop_id=shop_id, total_requests=0, total_accepted=0, reset_mode="manual"
    )
    db_session.add(history)
    db_session.commit()

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset_mode",
        headers=admin_headers,
        json={"reset_mode": "monthly", "user_id": staff_id},
    )

    assert res.status_code == 200
    refreshed = ShiftRejectionHistory.query.filter_by(user_id=staff_id, shop_id=shop_id).first()
    assert refreshed.reset_mode == "monthly"


def test_update_reset_mode_rejects_invalid_mode(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="rhadmin6@example.com", password="password123", role="admin", shop=shop)
    shop_id = shop.id
    admin_headers = auth_header("rhadmin6@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}/rejection_history/reset_mode",
        headers=admin_headers,
        json={"reset_mode": "invalid"},
    )

    assert res.status_code == 400
