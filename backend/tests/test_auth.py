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
