# backend/services/shift_lock.py
# 店舗単位のシフト確定・自動調整の排他制御。shiftsドメイン・auto_adjustドメインの両方から使われる。

from models import db, AutoAdjustConfig
from sqlalchemy.exc import IntegrityError, OperationalError


class ShiftLockConflict(Exception):
    """店舗単位のシフト確定/自動調整ロックが既に他のリクエストに保持されている場合に送出する。"""
    pass


def acquire_shop_shift_lock(shop_id: int) -> None:
    """
    店舗単位でシフト確定・自動調整処理を直列化するため、AutoAdjustConfigの該当店舗行を
    SELECT ... FOR UPDATE NOWAIT でロックする。他のリクエストが既にロックを保持している場合は
    ShiftLockConflict を送出する（呼び出し側でrollbackのうえ409を返す想定）。
    行が存在しない店舗の場合は先に作成してからロックを取得する。
    """
    cfg = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()
    if cfg is None:
        cfg = AutoAdjustConfig(shop_id=shop_id, priorities={}, capacities={})
        db.session.add(cfg)
        try:
            db.session.commit()
        except IntegrityError:
            # 並行して他のリクエストが同時に作成した場合は、それを使う
            db.session.rollback()

    try:
        AutoAdjustConfig.query.filter_by(shop_id=shop_id).with_for_update(nowait=True).one()
    except OperationalError as e:
        db.session.rollback()
        raise ShiftLockConflict() from e
