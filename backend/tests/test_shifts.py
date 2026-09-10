def test_submit_shift_requires_auth(client):
    res = client.post("/api/shifts/submit_request", json={"requests": []})

    assert res.status_code == 401


def test_submit_shift_request_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="staff@example.com", password="password123", role="staff", shop=shop)
    headers = auth_header("staff@example.com", "password123")

    res = client.post(
        "/api/shifts/submit_request",
        headers=headers,
        json={"requests": [{"date": "2026-10-01", "start": "09:00", "end": "17:00"}]},
    )

    assert res.status_code == 200
    assert "1件登録しました" in res.get_json()["message"]


def test_submit_shift_without_shop_fails(client, make_user, auth_header):
    make_user(email="noshop@example.com", password="password123", role="staff", shop=None)
    headers = auth_header("noshop@example.com", "password123")

    res = client.post(
        "/api/shifts/submit_request",
        headers=headers,
        json={"requests": [{"date": "2026-10-01", "start": "09:00", "end": "17:00"}]},
    )

    assert res.status_code == 400


def test_get_confirmed_shifts_empty(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="staff2@example.com", password="password123", role="staff", shop=shop)
    headers = auth_header("staff2@example.com", "password123")

    res = client.get("/api/shifts/2026-10-01", headers=headers)

    assert res.status_code == 200
    assert res.get_json()["confirmed_shifts"] == []


def test_admin_confirm_shifts(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="admin@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="staff3@example.com", password="password123", role="staff", shop=shop)
    staff_id = staff.id
    admin_headers = auth_header("admin@example.com", "password123")

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

    assert res.status_code == 200

    staff_headers = auth_header("staff3@example.com", "password123")
    check = client.get("/api/shifts/2026-10-01", headers=staff_headers)
    assert check.status_code == 200
    assert len(check.get_json()["confirmed_shifts"]) == 1


def test_admin_confirm_requires_admin_role(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="staff4@example.com", password="password123", role="staff", shop=shop)
    headers = auth_header("staff4@example.com", "password123")

    res = client.post(
        "/api/admin/shifts/confirm",
        headers=headers,
        json={
            "confirmed_shifts": [
                {"user_id": 1, "shift_date": "2026-10-01", "start_time": "09:00", "end_time": "17:00"}
            ]
        },
    )

    assert res.status_code == 403
