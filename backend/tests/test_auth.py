from models import User, ShiftRejectionHistory


def test_register_success(client):
    res = client.post(
        "/api/register",
        json={"name": "Taro Yamada", "email": "taro@example.com", "password": "password123"},
    )

    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["user_name"] == "Taro Yamada"
    assert data["user"]["role"] == "staff"


def test_register_missing_fields(client):
    res = client.post("/api/register", json={"name": "Taro"})

    assert res.status_code == 400


def test_register_rejects_disallowed_role(client):
    res = client.post(
        "/api/register",
        json={
            "name": "Rogue",
            "email": "rogue@example.com",
            "password": "password123",
            "role": "superadmin",
        },
    )

    assert res.status_code == 400
    assert User.query.filter_by(email="rogue@example.com").first() is None


def test_register_allows_self_registering_as_admin(client):
    """/api/shop_registerがrole=adminかつshop_id未設定のユーザーのみ許可するため、
    新規店舗オーナーとして始めるにはrole=adminでの自己登録が唯一の導線として意図的に許可されている。"""
    res = client.post(
        "/api/register",
        json={
            "name": "NewOwner",
            "email": "newowner@example.com",
            "password": "password123",
            "role": "admin",
        },
    )

    assert res.status_code == 201
    assert res.get_json()["user"]["role"] == "admin"


def test_register_duplicate_email(client, make_user):
    make_user(email="dup@example.com")

    res = client.post(
        "/api/register",
        json={"name": "Another", "email": "dup@example.com", "password": "password123"},
    )

    assert res.status_code == 400


def test_login_success(client, make_user):
    make_user(email="login@example.com", password="password123")

    res = client.post(
        "/api/login", json={"identifier": "login@example.com", "password": "password123"}
    )

    assert res.status_code == 200
    assert "access_token" in res.get_json()


def test_login_wrong_password(client, make_user):
    make_user(email="login2@example.com", password="password123")

    res = client.post(
        "/api/login", json={"identifier": "login2@example.com", "password": "wrong-password"}
    )

    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post(
        "/api/login", json={"identifier": "nobody@example.com", "password": "password123"}
    )

    assert res.status_code == 401


def test_logout(client):
    res = client.post("/api/logout")

    assert res.status_code == 200


def test_session_without_token_returns_none_user(client):
    res = client.get("/api/session")

    assert res.status_code == 200
    assert res.get_json()["user"] is None


def test_session_with_valid_token_returns_user(client, make_user, auth_header):
    make_user(email="session1@example.com", password="password123", name="SessionUser")
    headers = auth_header("session1@example.com", "password123")

    res = client.get("/api/session", headers=headers)

    assert res.status_code == 200
    assert res.get_json()["user"]["user_name"] == "SessionUser"


def test_edit_account_updates_name(client, make_user, auth_header):
    make_user(email="edit1@example.com", password="password123", name="OldName")
    headers = auth_header("edit1@example.com", "password123")

    res = client.post("/api/account/edit", headers=headers, json={"name": "NewName"})

    assert res.status_code == 200
    session_res = client.get("/api/session", headers=headers)
    assert session_res.get_json()["user"]["user_name"] == "NewName"


def test_edit_account_rejects_duplicate_email(client, make_user, auth_header):
    make_user(email="edit2@example.com", password="password123")
    make_user(email="taken@example.com", password="password123")
    headers = auth_header("edit2@example.com", "password123")

    res = client.post("/api/account/edit", headers=headers, json={"email": "taken@example.com"})

    assert res.status_code == 400


def test_edit_account_requires_auth(client):
    res = client.post("/api/account/edit", json={"name": "NoAuth"})

    assert res.status_code == 401


def test_delete_account_removes_user(client, make_user, auth_header):
    make_user(email="delete1@example.com", password="password123")
    headers = auth_header("delete1@example.com", "password123")

    res = client.post("/api/account/delete", headers=headers)

    assert res.status_code == 200

    login_res = client.post(
        "/api/login", json={"identifier": "delete1@example.com", "password": "password123"}
    )
    assert login_res.status_code == 401


def test_delete_account_requires_auth(client):
    res = client.post("/api/account/delete")

    assert res.status_code == 401


def test_delete_account_removes_rejection_history(client, make_shop, make_user, auth_header, db_session):
    """PostgreSQL（本番）はShiftRejectionHistory.user_idの外部キー制約をデフォルトで強制するため、
    棄却履歴を残したままdb.session.delete(user)すると制約違反でアカウント削除が失敗しうる（issue #80）。"""
    shop = make_shop()
    user = make_user(email="delete2@example.com", password="password123", role="staff", shop=shop)
    user_id = user.id
    headers = auth_header("delete2@example.com", "password123")

    history = ShiftRejectionHistory(
        user_id=user_id, shop_id=shop.id, total_requests=3, total_accepted=1, reset_mode="manual"
    )
    db_session.add(history)
    db_session.commit()

    res = client.post("/api/account/delete", headers=headers)

    assert res.status_code == 200
    assert ShiftRejectionHistory.query.filter_by(user_id=user_id).first() is None
