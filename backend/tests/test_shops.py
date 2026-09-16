from models import User, UserShop


def test_join_shop_request_success(client, make_shop, make_user, auth_header):
    shop = make_shop()
    shop_code = shop.shop_code
    make_user(email="joinstaff1@example.com", password="password123", role="staff")
    headers = auth_header("joinstaff1@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": shop_code}
    )

    assert res.status_code == 200


def test_join_shop_request_rejects_if_already_member_of_target_shop(client, make_shop, make_user, auth_header, db_session):
    """既に所属している店舗と同じ店舗コードへの参加リクエストは拒否する（issue #97）。"""
    shop = make_shop()
    shop_code = shop.shop_code
    user = make_user(email="joinstaff2@example.com", password="password123", role="staff", shop=shop)
    db_session.add(UserShop(user_id=user.id, shop_id=shop.id))
    db_session.commit()
    headers = auth_header("joinstaff2@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": shop_code}
    )

    assert res.status_code == 400


def test_join_shop_request_allows_requesting_additional_shop(client, make_shop, make_user, auth_header, db_session):
    """既に別の店舗に所属していても、別の店舗への参加リクエストは送れる（複数店舗所属対応、issue #97）。"""
    shop = make_shop()
    other_shop = make_shop(name="Other Shop")
    other_shop_code = other_shop.shop_code
    user = make_user(email="joinstaff2b@example.com", password="password123", role="staff", shop=shop)
    db_session.add(UserShop(user_id=user.id, shop_id=shop.id))
    db_session.commit()
    headers = auth_header("joinstaff2b@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": other_shop_code}
    )

    assert res.status_code == 200
    refreshed = db_session.get(User, user.id)
    assert refreshed.shop_request_code == other_shop_code
    # アクティブ店舗は変更されない
    assert refreshed.shop_id == shop.id


def test_join_shop_request_rejects_duplicate_pending_request(client, make_shop, make_user, auth_header, db_session):
    """保留中の参加リクエストが既にある場合、別店舗への新規リクエストは拒否する（1ユーザー同時1件まで、issue #97）。"""
    other_shop = make_shop(name="Other Shop")
    third_shop = make_shop(name="Third Shop")
    third_shop_code = third_shop.shop_code
    user = make_user(email="joinstaff2c@example.com", password="password123", role="staff")
    user.shop_request_code = other_shop.shop_code
    db_session.commit()
    headers = auth_header("joinstaff2c@example.com", "password123")

    res = client.post(
        "/api/join_shop/request", headers=headers, json={"shop_code": third_shop_code}
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


def test_get_join_requests_includes_requester_with_existing_shop(client, make_shop, make_user, auth_header, db_session):
    """複数店舗所属対応: 既に別の店舗に所属しているユーザーからのリクエストも一覧に含める（issue #97）。"""
    shop = make_shop()
    other_shop = make_shop(name="Other Shop")
    make_user(email="joinadmin1b@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff4b@example.com", password="password123", role="staff", shop=other_shop)
    requester_id = requester.id
    requester.shop_request_code = shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin1b@example.com", "password123")

    res = client.get("/api/join_requests", headers=admin_headers)

    assert res.status_code == 200
    requester_ids = {r["user_id"] for r in res.get_json()["requests"]}
    assert requester_id in requester_ids


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
    assert UserShop.query.filter_by(user_id=requester_id, shop_id=shop_id).first() is not None


def test_handle_join_request_approve_keeps_existing_active_shop(client, make_shop, make_user, auth_header, db_session):
    """既にアクティブな店舗を持つユーザーが別の店舗の参加リクエストを承認されても、
    アクティブ店舗（shop_id）は自動で切り替わらない（issue #97）。切替は別途アクティブ店舗切替APIで行う。"""
    home_shop = make_shop(name="Home Shop")
    new_shop = make_shop(name="New Shop")
    make_user(email="joinadmin2b@example.com", password="password123", role="admin", shop=new_shop)
    requester = make_user(email="joinstaff6b@example.com", password="password123", role="staff", shop=home_shop)
    requester_id, home_shop_id, new_shop_id = requester.id, home_shop.id, new_shop.id
    db_session.add(UserShop(user_id=requester_id, shop_id=home_shop_id))
    requester.shop_request_code = new_shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin2b@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "approve"}
    )

    assert res.status_code == 200

    refreshed = db_session.get(User, requester_id)
    assert refreshed.shop_id == home_shop_id  # アクティブ店舗は変わらない
    assert refreshed.shop_request_code is None
    assert UserShop.query.filter_by(user_id=requester_id, shop_id=new_shop_id).first() is not None


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


def test_handle_join_request_invalid_action(client, make_shop, make_user, auth_header, db_session):
    shop = make_shop()
    make_user(email="joinadmin4@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff8@example.com", password="password123", role="staff")
    requester_id = requester.id
    requester.shop_request_code = shop.shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin4@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "bogus"}
    )

    assert res.status_code == 400


def test_handle_join_request_rejects_body_without_json_content_type(client, make_shop, make_user, auth_header):
    """Content-Typeがapplication/json以外だとrequest.jsonは415を送出するため、
    get_json(silent=True)経由で取得し400を返すことを確認する（issue #109レビュー対応）。"""
    shop = make_shop()
    make_user(email="joinadmin5b@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff9b@example.com", password="password123", role="staff")
    requester_id = requester.id
    admin_headers = auth_header("joinadmin5b@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}",
        headers=admin_headers,
        data="{}",
        content_type="text/plain",
    )

    assert res.status_code == 400


def test_handle_join_request_rejects_approve_without_matching_request(client, make_shop, make_user, auth_header):
    """target_userが自店舗への参加をリクエストしていない場合、承認できない（issue #85）。
    admin権限があってもuser_idを変えるだけで任意ユーザーを強制加入させられてはならない。"""
    shop = make_shop()
    make_user(email="joinadmin5@example.com", password="password123", role="admin", shop=shop)
    # 参加リクエストを送っていない（shop_request_codeが未設定の）ユーザー
    bystander = make_user(email="joinstaff9@example.com", password="password123", role="staff")
    bystander_id = bystander.id
    admin_headers = auth_header("joinadmin5@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{bystander_id}", headers=admin_headers, json={"action": "approve"}
    )

    assert res.status_code == 404


def test_handle_join_request_rejects_approve_for_different_shop_request(client, make_shop, make_user, auth_header, db_session):
    """target_userが別の店舗への参加をリクエストしている場合、自店舗への承認はできない（issue #85）。"""
    shop = make_shop()
    other_shop = make_shop(name="Other Shop")
    other_shop_code = other_shop.shop_code
    make_user(email="joinadmin6@example.com", password="password123", role="admin", shop=shop)
    requester = make_user(email="joinstaff10@example.com", password="password123", role="staff")
    requester_id = requester.id
    requester.shop_request_code = other_shop_code
    db_session.commit()
    admin_headers = auth_header("joinadmin6@example.com", "password123")

    res = client.post(
        f"/api/join_requests/{requester_id}", headers=admin_headers, json={"action": "approve"}
    )

    assert res.status_code == 404
    refreshed = db_session.get(User, requester_id)
    assert refreshed.shop_id is None
    assert refreshed.shop_request_code == other_shop_code


def test_get_my_shops_returns_memberships(client, make_shop, make_user, auth_header, db_session):
    shop_a = make_shop(name="Shop A")
    shop_b = make_shop(name="Shop B")
    shop_a_id, shop_b_id = shop_a.id, shop_b.id
    user = make_user(email="myshops1@example.com", password="password123", role="staff", shop=shop_a)
    db_session.add_all([
        UserShop(user_id=user.id, shop_id=shop_a_id),
        UserShop(user_id=user.id, shop_id=shop_b_id),
    ])
    db_session.commit()
    headers = auth_header("myshops1@example.com", "password123")

    res = client.get("/api/my_shops", headers=headers)

    assert res.status_code == 200
    shops = res.get_json()["shops"]
    shop_ids = {s["shop_id"]: s for s in shops}
    assert set(shop_ids.keys()) == {shop_a_id, shop_b_id}
    assert shop_ids[shop_a_id]["is_active"] is True
    assert shop_ids[shop_b_id]["is_active"] is False


def test_get_my_shops_empty_when_no_memberships(client, make_user, auth_header):
    make_user(email="myshops2@example.com", password="password123", role="staff", shop=None)
    headers = auth_header("myshops2@example.com", "password123")

    res = client.get("/api/my_shops", headers=headers)

    assert res.status_code == 200
    assert res.get_json()["shops"] == []


def test_get_my_shops_requires_auth(client):
    res = client.get("/api/my_shops")

    assert res.status_code == 401


def test_switch_active_shop_success(client, make_shop, make_user, auth_header, db_session):
    shop_a = make_shop(name="Shop A")
    shop_b = make_shop(name="Shop B")
    shop_b_id = shop_b.id
    user = make_user(email="switch1@example.com", password="password123", role="staff", shop=shop_a)
    db_session.add_all([
        UserShop(user_id=user.id, shop_id=shop_a.id),
        UserShop(user_id=user.id, shop_id=shop_b.id),
    ])
    db_session.commit()
    headers = auth_header("switch1@example.com", "password123")

    res = client.post("/api/active_shop", headers=headers, json={"shop_id": shop_b_id})

    assert res.status_code == 200
    refreshed = db_session.get(User, user.id)
    assert refreshed.shop_id == shop_b_id


def test_switch_active_shop_rejects_non_member_shop(client, make_shop, make_user, auth_header, db_session):
    shop_a = make_shop(name="Shop A")
    shop_a_id = shop_a.id
    other_shop = make_shop(name="Other Shop")
    other_shop_id = other_shop.id
    user = make_user(email="switch2@example.com", password="password123", role="staff", shop=shop_a)
    db_session.add(UserShop(user_id=user.id, shop_id=shop_a_id))
    db_session.commit()
    headers = auth_header("switch2@example.com", "password123")

    res = client.post("/api/active_shop", headers=headers, json={"shop_id": other_shop_id})

    assert res.status_code == 403
    refreshed = db_session.get(User, user.id)
    assert refreshed.shop_id == shop_a_id


def test_switch_active_shop_requires_auth(client):
    res = client.post("/api/active_shop", json={"shop_id": 1})

    assert res.status_code == 401


def test_switch_active_shop_rejects_non_integer_shop_id(client, make_user, auth_header):
    """shop_idが非整数（辞書・配列等）の場合、DBクエリに渡す前に400で拒否する（issue #104）。"""
    make_user(email="switch3@example.com", password="password123", role="staff", shop=None)
    headers = auth_header("switch3@example.com", "password123")

    res = client.post("/api/active_shop", headers=headers, json={"shop_id": {"nested": "object"}})

    assert res.status_code == 400


def test_switch_active_shop_rejects_boolean_shop_id(client, make_user, auth_header):
    """boolはintのサブクラスのため、暗黙変換されてしまわないよう明示的に拒否する（issue #104）。"""
    make_user(email="switch4@example.com", password="password123", role="staff", shop=None)
    headers = auth_header("switch4@example.com", "password123")

    res = client.post("/api/active_shop", headers=headers, json={"shop_id": True})

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
