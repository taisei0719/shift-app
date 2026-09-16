from models import User


def test_shop_register_sets_admin_shop_id(client, db_session, make_user, auth_header):
    admin = make_user(email="owner@example.com", password="password123", role="admin", shop=None)
    admin_id = admin.id
    headers = auth_header("owner@example.com", "password123")

    res = client.post(
        "/api/shop_register",
        headers=headers,
        json={"name": "My Shop", "location": "Tokyo"},
    )

    assert res.status_code == 200
    shop_id = res.get_json()["shop_id"]

    updated_admin = db_session.get(User, admin_id)
    assert updated_admin.shop_id == shop_id


def test_shop_register_requires_admin_role(client, make_user, auth_header):
    make_user(email="staffonly@example.com", password="password123", role="staff", shop=None)
    headers = auth_header("staffonly@example.com", "password123")

    res = client.post(
        "/api/shop_register",
        headers=headers,
        json={"name": "Staff Shop", "location": "Osaka"},
    )

    assert res.status_code == 403


def test_shop_register_rejects_duplicate_shop_name(client, make_shop, make_user, auth_header):
    make_shop(name="Existing Shop")
    make_user(email="owner2@example.com", password="password123", role="admin", shop=None)
    headers = auth_header("owner2@example.com", "password123")

    res = client.post(
        "/api/shop_register",
        headers=headers,
        json={"name": "Existing Shop", "location": "Osaka"},
    )

    assert res.status_code == 400


def test_shop_register_rejects_literal_null_body(client, make_user, auth_header):
    """JSONのnullリテラルはdata.get()呼び出し前に400で弾く。"""
    make_user(email="owner3@example.com", password="password123", role="admin", shop=None)
    headers = auth_header("owner3@example.com", "password123")

    res = client.post(
        "/api/shop_register", headers=headers, data="null", content_type="application/json"
    )

    assert res.status_code == 400


def test_shop_register_rejects_missing_name(client, make_user, auth_header):
    make_user(email="owner4@example.com", password="password123", role="admin", shop=None)
    headers = auth_header("owner4@example.com", "password123")

    res = client.post(
        "/api/shop_register", headers=headers, json={"location": "Tokyo"}
    )

    assert res.status_code == 400


def test_shop_register_rejects_too_long_name(client, make_user, auth_header):
    make_user(email="owner5@example.com", password="password123", role="admin", shop=None)
    headers = auth_header("owner5@example.com", "password123")

    res = client.post(
        "/api/shop_register", headers=headers, json={"name": "x" * 81, "location": "Tokyo"}
    )

    assert res.status_code == 400


def test_register_to_shop_register_to_shift_submit_end_to_end(client):
    """新規登録→ログイン→店舗登録→シフト提出までを、実際のAPI呼び出しのみで通す統合テスト。"""
    register_res = client.post(
        "/api/register",
        json={"name": "Owner Taro", "email": "e2e-owner@example.com", "password": "password123", "role": "admin"},
    )
    assert register_res.status_code == 201

    login_res = client.post(
        "/api/login", json={"identifier": "e2e-owner@example.com", "password": "password123"}
    )
    assert login_res.status_code == 200
    headers = {"Authorization": f"Bearer {login_res.get_json()['access_token']}"}

    shop_res = client.post(
        "/api/shop_register",
        headers=headers,
        json={"name": "E2E Shop", "location": "Tokyo"},
    )
    assert shop_res.status_code == 200

    submit_res = client.post(
        "/api/shifts/submit_request",
        headers=headers,
        json={"requests": [{"date": "2026-10-01", "start": "09:00", "end": "17:00"}]},
    )
    assert submit_res.status_code == 200
    assert "1件登録しました" in submit_res.get_json()["message"]
