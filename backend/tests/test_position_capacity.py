from models import AutoAdjustConfig, Shift


def test_submit_request_stamps_user_position(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="posstaff1@example.com", password="password123", role="staff", shop=shop, position="kitchen")
    headers = auth_header("posstaff1@example.com", "password123")

    res = client.post(
        "/api/shifts/submit_request",
        headers=headers,
        json={"requests": [{"date": "2026-10-01", "start": "09:00", "end": "17:00"}]},
    )
    assert res.status_code == 200

    shift = Shift.query.filter_by(shift_type="request").first()
    assert shift.position == "kitchen"


def test_confirm_shifts_stamps_current_user_position(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="posadmin1@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="posstaff2@example.com", password="password123", role="staff", shop=shop, position="hall")
    staff_id = staff.id
    admin_headers = auth_header("posadmin1@example.com", "password123")

    res = client.post(
        "/api/admin/shifts/confirm",
        headers=admin_headers,
        json={
            "confirmed_shifts": [
                {"user_id": staff_id, "shift_date": "2026-10-01", "start_time": "09:00", "end_time": "17:00"}
            ]
        },
    )
    assert res.status_code == 200

    shift = Shift.query.filter_by(shift_type="confirmed", user_id=staff_id).first()
    assert shift.position == "hall"


def test_auto_adjust_respects_per_position_capacity(client, make_shop, make_user, auth_header, db_session):
    """同じ時間帯でもpositionが違えば別枠として扱われ、position別の定員がそれぞれ適用される。"""
    shop = make_shop()
    make_user(email="posadmin2@example.com", password="password123", role="admin", shop=shop)
    kitchen1 = make_user(email="kitchen1@example.com", password="password123", role="staff", shop=shop, position="kitchen")
    kitchen2 = make_user(email="kitchen2@example.com", password="password123", role="staff", shop=shop, position="kitchen")
    hall1 = make_user(email="hall1@example.com", password="password123", role="staff", shop=shop, position="hall")
    kitchen1_id, kitchen2_id, hall1_id = kitchen1.id, kitchen2.id, hall1.id
    shop_id = shop.id

    # kitchenの定員は10時台1人まで、hallは制限なし
    cfg = AutoAdjustConfig(shop_id=shop_id, priorities={}, capacities={"kitchen": {"10": 1}})
    db_session.add(cfg)
    db_session.commit()

    admin_headers = auth_header("posadmin2@example.com", "password123")

    for email in ["kitchen1@example.com", "kitchen2@example.com", "hall1@example.com"]:
        headers = auth_header(email, "password123")
        client.post(
            "/api/shifts/submit_request",
            headers=headers,
            json={"requests": [{"date": "2026-10-01", "start": "10:00", "end": "11:00"}]},
        )

    res = client.post(
        "/api/admin/shifts/auto_adjust/2026-10-01",
        headers=admin_headers,
        json={"apply": False},
    )
    assert res.status_code == 200
    assignments = res.get_json()["assignments"]
    assigned_user_ids = {a["user_id"] for a in assignments}

    # kitchenは定員1のため、kitchen1・kitchen2のどちらか1人だけが採用される
    kitchen_assigned = assigned_user_ids & {kitchen1_id, kitchen2_id}
    assert len(kitchen_assigned) == 1
    # hallは定員無制限のためhall1は採用される
    assert hall1_id in assigned_user_ids


def test_auto_adjust_honors_legacy_flat_capacities(client, make_shop, make_user, auth_header, db_session):
    """SBI #66未マージのフロントエンドが送る旧形式（フラットな{"<hour>": int}）のcapacitiesでも
    position未設定のシフトに対して定員が正しく効くことを確認する（後方互換）。"""
    shop = make_shop()
    make_user(email="posadmin4@example.com", password="password123", role="admin", shop=shop)
    staff1 = make_user(email="nopos1@example.com", password="password123", role="staff", shop=shop)
    staff2 = make_user(email="nopos2@example.com", password="password123", role="staff", shop=shop)
    staff1_id, staff2_id = staff1.id, staff2.id
    shop_id = shop.id

    # 旧形式: ポジションキーを持たないフラットな時間帯別定員
    cfg = AutoAdjustConfig(shop_id=shop_id, priorities={}, capacities={"10": 1})
    db_session.add(cfg)
    db_session.commit()

    admin_headers = auth_header("posadmin4@example.com", "password123")

    for email in ["nopos1@example.com", "nopos2@example.com"]:
        headers = auth_header(email, "password123")
        client.post(
            "/api/shifts/submit_request",
            headers=headers,
            json={"requests": [{"date": "2026-10-01", "start": "10:00", "end": "11:00"}]},
        )

    res = client.post(
        "/api/admin/shifts/auto_adjust/2026-10-01",
        headers=admin_headers,
        json={"apply": False},
    )
    assert res.status_code == 200
    assigned_user_ids = {a["user_id"] for a in res.get_json()["assignments"]}

    # 旧形式のcapacitiesが無視されて無制限扱いになっていないか（=両方採用されていないか）を確認
    assert len(assigned_user_ids & {staff1_id, staff2_id}) == 1


def test_update_user_position_by_admin(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="posadmin3@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="posstaff3@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("posadmin3@example.com", "password123")

    res = client.patch(
        f"/api/shops/{shop_id}/users/{staff_id}/position",
        headers=admin_headers,
        json={"position": "kitchen"},
    )

    assert res.status_code == 200
    assert res.get_json()["position"] == "kitchen"


def test_update_user_position_requires_admin(client, make_shop, make_user, auth_header):
    shop = make_shop()
    staff = make_user(email="posstaff4@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    headers = auth_header("posstaff4@example.com", "password123")

    res = client.patch(
        f"/api/shops/{shop_id}/users/{staff_id}/position",
        headers=headers,
        json={"position": "kitchen"},
    )

    assert res.status_code == 403


def test_update_user_position_rejects_non_string_position(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="posadmin5@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="posstaff5@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("posadmin5@example.com", "password123")

    res = client.patch(
        f"/api/shops/{shop_id}/users/{staff_id}/position",
        headers=admin_headers,
        json={"position": 12345},
    )

    assert res.status_code == 400


def test_update_user_position_rejects_too_long_position(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="posadmin6@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="posstaff6@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    shop_id = shop.id
    admin_headers = auth_header("posadmin6@example.com", "password123")

    res = client.patch(
        f"/api/shops/{shop_id}/users/{staff_id}/position",
        headers=admin_headers,
        json={"position": "x" * 51},
    )

    assert res.status_code == 400
