from app import init_db
from models import User, UserShop
from services.user_shops import backfill_user_shops, ensure_user_shop_membership


def test_ensure_user_shop_membership_creates_row(app, make_shop, make_user, db_session):
    shop = make_shop()
    user = make_user(shop=shop)

    ensure_user_shop_membership(user.id, shop.id)
    db_session.commit()

    rows = UserShop.query.filter_by(user_id=user.id, shop_id=shop.id).all()
    assert len(rows) == 1


def test_ensure_user_shop_membership_is_idempotent(app, make_shop, make_user, db_session):
    shop = make_shop()
    user = make_user(shop=shop)

    ensure_user_shop_membership(user.id, shop.id)
    ensure_user_shop_membership(user.id, shop.id)
    db_session.commit()

    rows = UserShop.query.filter_by(user_id=user.id, shop_id=shop.id).all()
    assert len(rows) == 1


def test_backfill_user_shops_creates_rows_for_existing_users(app, make_shop, make_user):
    shop = make_shop()
    other_shop = make_shop(name="Other Shop")
    user1 = make_user(email="backfill1@example.com", shop=shop)
    user2 = make_user(email="backfill2@example.com", shop=other_shop)
    # 店舗未所属のユーザーはバックフィル対象外
    user3 = make_user(email="backfill3@example.com", shop=None)

    created = backfill_user_shops()

    assert created == 2
    assert UserShop.query.filter_by(user_id=user1.id, shop_id=shop.id).first() is not None
    assert UserShop.query.filter_by(user_id=user2.id, shop_id=other_shop.id).first() is not None
    assert UserShop.query.filter_by(user_id=user3.id).first() is None


def test_backfill_user_shops_is_idempotent(app, make_shop, make_user):
    shop = make_shop()
    user = make_user(shop=shop)

    first_run = backfill_user_shops()
    second_run = backfill_user_shops()

    assert first_run == 1
    assert second_run == 0
    assert UserShop.query.filter_by(user_id=user.id, shop_id=shop.id).count() == 1


def test_init_db_on_fresh_database_backfills_demo_users(app):
    """まっさらなDB（デモユーザーも未作成）でinit_db()を実行した場合、
    その場で作成されるデモadmin/staffもuser_shopsへ登録される（issue #101 CodeRabbit指摘）。"""
    assert User.query.count() == 0

    init_db()

    demo_users = User.query.filter(User.name.in_(["admin", "yamada"])).all()
    assert len(demo_users) == 2
    for user in demo_users:
        assert UserShop.query.filter_by(user_id=user.id, shop_id=user.shop_id).first() is not None


def test_shop_register_creates_user_shop_membership(client, make_user, auth_header):
    make_user(email="registerowner@example.com", password="password123", role="admin", shop=None)
    headers = auth_header("registerowner@example.com", "password123")

    res = client.post(
        "/api/shop_register",
        headers=headers,
        json={"name": "New Registered Shop", "location": "Tokyo"},
    )

    assert res.status_code == 200
    shop_id = res.get_json()["shop_id"]

    admin = User.query.filter_by(email="registerowner@example.com").first()
    assert UserShop.query.filter_by(user_id=admin.id, shop_id=shop_id).first() is not None
