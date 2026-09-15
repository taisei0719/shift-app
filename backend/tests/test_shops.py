from models import User


def test_join_shop_request_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    shop_code = shop.shop_code
    make_user(email="joinstaff1@example.com", password="password123", role="staff")
    headers = auth_header("joinstaff1@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": shop_code}
    )

    assert res.status_code == 200


def test_join_shop_request_rejects_if_already_in_shop(client, make_shop, make_user, auth_header):
    shop = make_shop()
    other_shop = make_shop(name="Other Shop")
    other_shop_code = other_shop.shop_code
    make_user(email="joinstaff2@example.com", password="password123", role="staff", shop=shop)
    headers = auth_header("joinstaff2@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": other_shop_code}
    )

    assert res.status_code == 400


def test_join_shop_request_rejects_invalid_code(client, make_user, auth_header):
    make_user(email="joinstaff3@example.com", password="password123", role="staff")
    headers = auth_header("joinstaff3@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": "nonexistent"}
    )

    assert res.status_code == 404


def test_get_join_requests_returns_pending_requests(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="joinadmin1@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff4@example.com", password="password123", role="staff")
    requester_id = requester.id
    requester.shop_request_code = shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin1@example.com", "password123")

    res = client.get("/api/join_requests", headers=admin_headers)

    assert res.status_code == 200
    requester_ids = {r["user_id"] for r in res.get_json()["requests"]}
    assert requester_id in requester_ids


def test_get_join_requests_requires_admin(client, make_user, auth_header):
    make_user(email="joinstaff5@example.com", password="password123", role="staff")
    headers = auth_header("joinstaff5@example.com", "password123")

    res = client.get("/api/join_requests", headers=headers)

    assert res.status_code == 403


def test_handle_join_request_approve(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="joinadmin2@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff6@example.com", password="password123", role="staff")
    requester_id, shop_id = requester.id, shop.id
    requester.shop_request_code = shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin2@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "approve"}
    )

    assert res.status_code == 200

    refreshed = db_session.get(User, requester_id)
    assert refreshed.shop_id == shop_id
    assert refreshed.shop_request_code is None


def test_handle_join_request_reject(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="joinadmin3@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff7@example.com", password="password123", role="staff")
    requester_id = requester.id
    requester.shop_request_code = shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin3@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "reject"}
    )

    assert res.status_code == 200

    refreshed = db_session.get(User, requester_id)
    assert refreshed.shop_id is None
    assert refreshed.shop_request_code is None


def test_handle_join_request_invalid_action(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="joinadmin4@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff8@example.com", password="password123", role="staff")
    requester_id = requester.id
    admin_headers = auth_header("joinadmin4@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "bogus"}
    )

    assert res.status_code == 400


def test_get_shop_detail_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="shopdetail1@example.com", password="password123", role="staff", shop=shop)
    shop_id = shop.id
    headers = auth_header("shopdetail1@example.com", "password123")

    res = client.get(f"/api/shop/{shop_id}", headers=headers)

    assert res.status_code == 200
    assert res.get_json()["shop_id"] == shop_id


def test_get_shop_detail_rejects_other_shop(client, make_shop, make_user, auth_header):
    shop = make_shop()
    other_shop = make_shop(name="Other Shop 2")
    make_user(email="shopdetail2@example.com", password="password123", role="staff", shop=shop)
    other_shop_id = other_shop.id
    headers = auth_header("shopdetail2@example.com", "password123")

    res = client.get(f"/api/shop/{other_shop_id}", headers=headers)

    assert res.status_code == 403


def test_update_shop_detail_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="shopupdate1@example.com", password="password123", role="admin", shop=shop)
    shop_id = shop.id
    headers = auth_header("shopupdate1@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}", headers=headers, json={"location": "New Location"}
    )

    assert res.status_code == 200
    detail_res = client.get(f"/api/shop/{shop_id}", headers=headers)
    assert detail_res.get_json()["location"] == "New Location"


def test_update_shop_detail_requires_admin(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="shopupdate2@example.com", password="password123", role="staff", shop=shop)
    shop_id = shop.id
    headers = auth_header("shopupdate2@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}", headers=headers, json={"location": "Nope"}
    )

    assert res.status_code == 403


def test_update_shop_detail_rejects_duplicate_name(client, make_shop, make_user, auth_header):
    make_shop(name="Taken Name")
    shop = make_shop()
    make_user(email="shopupdate3@example.com", password="password123", role="admin", shop=shop)
    shop_id = shop.id
    headers = auth_header("shopupdate3@example.com", "password123")

    res = client.post(
        f"/api/shop/{shop_id}", headers=headers, json={"name": "Taken Name"}
    )

    assert res.status_code == 400


def test_get_shop_users_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    make_user(email="shopusers1@example.com", password="password123", role="admin", shop=shop)
    staff = make_user(email="shopusers2@example.com", password="password123", role="staff", shop=shop)
    staff_id, shop_id = staff.id, shop.id
    headers = auth_header("shopusers1@example.com", "password123")

    res = client.get(f"/api/shops/{shop_id}/users", headers=headers)

    assert res.status_code == 200
    user_ids = {u["user_id"] for u in res.get_json()["users"]}
    assert staff_id in user_ids


def test_get_shop_users_rejects_other_shop(client, make_shop, make_user, auth_header):
    shop = make_shop()
    other_shop = make_shop(name="Other Shop 3")
    make_user(email="shopusers3@example.com", password="password123", role="staff", shop=shop)
    other_shop_id = other_shop.id
    headers = auth_header("shopusers3@example.com", "password123")

    res = client.get(f"/api/shops/{other_shop_id}/users", headers=headers)

    assert res.status_code == 403
