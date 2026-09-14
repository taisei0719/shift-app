def test_shop_register_without_csrf_token_rejected(client, make_user):
    make_user(email="csrf-owner1@example.com", password="password123", role="admin", shop=None)
    login_res = client.post(
        "/api/login", json={"identifier": "csrf-owner1@example.com", "password": "password123"}
    )
    assert login_res.status_code == 200

    # Authorizationヘッダーを付けず、cookie認証のみでアクセス（CSRFトークンなし）
    res = client.post("/api/shop_register", json={"name": "No CSRF Shop", "location": "Tokyo"})
    assert res.status_code in (401, 403, 422)


def test_shop_register_with_csrf_token_succeeds(client, make_user):
    make_user(email="csrf-owner2@example.com", password="password123", role="admin", shop=None)
    login_res = client.post(
        "/api/login", json={"identifier": "csrf-owner2@example.com", "password": "password123"}
    )
    assert login_res.status_code == 200

    csrf_cookie = client.get_cookie("csrf_access_token")
    assert csrf_cookie is not None

    res = client.post(
        "/api/shop_register",
        json={"name": "CSRF OK Shop", "location": "Tokyo"},
        headers={"X-CSRF-TOKEN": csrf_cookie.value},
    )
    assert res.status_code == 200
