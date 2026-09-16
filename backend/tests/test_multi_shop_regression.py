# backend/tests/test_multi_shop_regression.py
# 複数店舗所属対応（PBI #7 / SBI #96-#99）後も、単一店舗のみに所属する
# ユーザーの既存フローが一貫して動作することを確認する回帰テスト（SBI #100）。

from models import User, UserShop, ShiftRejectionHistory


def test_single_shop_user_full_lifecycle(client, make_shop, auth_header, db_session):
    """店舗登録→参加リクエスト→承認→シフト提出→確定→自動調整→棄却履歴→
    アカウント削除まで、単一店舗のみに所属するユーザーの一連の流れが
    複数店舗対応の導入後も後方互換に動作することを確認する。"""

    # 1. 管理者が新規登録し、店舗を作成する
    register_res = client.post(
        "/api/register",
        json={"name": "Regression Owner", "email": "regowner@example.com", "password": "password123", "role": "admin"},
    )
    assert register_res.status_code == 201
    admin_headers = auth_header("regowner@example.com", "password123")

    shop_res = client.post(
        "/api/shop_register",
        headers=admin_headers,
        json={"name": "Regression Shop", "location": "Tokyo"},
    )
    assert shop_res.status_code == 200
    shop_id = shop_res.get_json()["shop_id"]

    admin = User.query.filter_by(email="regowner@example.com").first()
    # 単一店舗のみに所属していること（user_shopsは1件のみ）
    assert UserShop.query.filter_by(user_id=admin.id).count() == 1
    assert admin.shop_id == shop_id

    # 2. スタッフが登録し、店舗コードで参加リクエストを送る
    staff_register_res = client.post(
        "/api/register",
        json={"name": "Regression Staff", "email": "regstaff@example.com", "password": "password123"},
    )
    assert staff_register_res.status_code == 201
    staff = User.query.filter_by(email="regstaff@example.com").first()
    staff_id = staff.id
    staff_headers = auth_header("regstaff@example.com", "password123")

    shop_code = shop_res.get_json()["shop_code"]
    join_res = client.post("/api/join_shop/request", headers=staff_headers, json={"shop_code": shop_code})
    assert join_res.status_code == 200

    # 3. 管理者が参加リクエストを承認する
    approve_res = client.post(
        f"/api/join_requests/{staff_id}", headers=admin_headers, json={"action": "approve"}
    )
    assert approve_res.status_code == 200

    refreshed_staff = db_session.get(User, staff_id)
    assert refreshed_staff.shop_id == shop_id
    assert UserShop.query.filter_by(user_id=staff_id).count() == 1

    # 単一店舗のみの所属なので、所属店舗一覧は1件のみ（フロントの切替UIは表示されない想定）
    my_shops_res = client.get("/api/my_shops", headers=staff_headers)
    assert my_shops_res.status_code == 200
    assert len(my_shops_res.get_json()["shops"]) == 1

    # 4. シフト希望を提出する
    submit_res = client.post(
        "/api/shifts/submit_request",
        headers=staff_headers,
        json={"requests": [{"date": "2026-11-02", "start": "09:00", "end": "17:00"}]},
    )
    assert submit_res.status_code == 200

    # 5. 管理者がシフトを確定する
    confirm_res = client.post(
        "/api/admin/shifts/confirm",
        headers=admin_headers,
        json={
            "confirmed_shifts": [
                {"user_id": staff_id, "shift_date": "2026-11-02", "start_time": "09:00", "end_time": "17:00"}
            ]
        },
    )
    assert confirm_res.status_code == 200

    confirmed_check = client.get("/api/shifts/2026-11-02", headers=staff_headers)
    assert confirmed_check.status_code == 200
    assert len(confirmed_check.get_json()["confirmed_shifts"]) == 1

    # 棄却履歴が正しく記録されていること
    history = ShiftRejectionHistory.query.filter_by(user_id=staff_id, shop_id=shop_id).first()
    assert history is not None
    assert history.total_requests == 1
    assert history.total_accepted == 1

    # 6. 自動調整のシミュレーションを実行する
    another_submit_res = client.post(
        "/api/shifts/submit_request",
        headers=staff_headers,
        json={"requests": [{"date": "2026-11-03", "start": "10:00", "end": "18:00"}]},
    )
    assert another_submit_res.status_code == 200

    auto_adjust_res = client.post(
        "/api/admin/shifts/auto_adjust/2026-11-03",
        headers=admin_headers,
        json={"apply": False},
    )
    assert auto_adjust_res.status_code == 200
    metrics = auto_adjust_res.get_json()["metrics"]
    assert metrics["users"][str(staff_id)]["rejection_rate_before"] == 0.0

    # 7. アカウント削除（Shift・ShiftRejectionHistoryを含めて正しく削除できること）
    delete_res = client.post("/api/account/delete", headers=staff_headers)
    assert delete_res.status_code == 200
    assert db_session.get(User, staff_id) is None
    assert ShiftRejectionHistory.query.filter_by(user_id=staff_id).first() is None
    assert UserShop.query.filter_by(user_id=staff_id).first() is None
