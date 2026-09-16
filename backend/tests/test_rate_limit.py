def test_login_within_limit_succeeds(client, make_user):
    make_user(email="ratelimit-ok@example.com", password="password123")

    for _ in range(9):
        res = client.post(
            "/api/login",
            json={"identifier": "ratelimit-ok@example.com", "password": "wrong-password"},
        )
        assert res.status_code == 401

    res = client.post(
        "/api/login",
        json={"identifier": "ratelimit-ok@example.com", "password": "password123"},
    )
    assert res.status_code == 200

    res = client.post(
        "/api/login",
        json={"identifier": "ratelimit-ok@example.com", "password": "password123"},
    )
    assert res.status_code == 429


def test_register_exceeding_limit_returns_429(client):
    for i in range(10):
        res = client.post(
            "/api/register",
            json={"name": f"User {i}", "email": f"ratelimit{i}@example.com", "password": "password123"},
        )
        assert res.status_code == 201

    res = client.post(
        "/api/register",
        json={"name": "Overflow", "email": "overflow@example.com", "password": "password123"},
    )
    assert res.status_code == 429
