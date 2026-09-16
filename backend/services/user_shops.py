# backend/services/user_shops.py
# 複数店舗所属（PBI #7）の所属関係（user_shops）を管理する共有ロジック。

from models import db, User, UserShop


def ensure_user_shop_membership(user_id: int, shop_id: int) -> None:
    """指定ユーザーが指定店舗のuser_shopsメンバーであることを保証する（既にあれば何もしない）。
    コミットは呼び出し側の既存トランザクションに合わせて行うため、ここではflush/commitしない。"""
    exists = UserShop.query.filter_by(user_id=user_id, shop_id=shop_id).first()
    if exists is None:
        db.session.add(UserShop(user_id=user_id, shop_id=shop_id))


def backfill_user_shops() -> int:
    """既存のUser.shop_id（アクティブ店舗）を持つ全ユーザーについて、
    対応するuser_shops行が無ければ作成する（冪等、何度実行しても安全）。

    Returns:
        新規作成した行数
    """
    users_with_shop = User.query.filter(User.shop_id.isnot(None)).all()
    created = 0
    for user in users_with_shop:
        if UserShop.query.filter_by(user_id=user.id, shop_id=user.shop_id).first() is None:
            db.session.add(UserShop(user_id=user.id, shop_id=user.shop_id))
            created += 1
    db.session.commit()
    return created
