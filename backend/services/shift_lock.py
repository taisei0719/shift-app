# backend/services/shift_lock.py
# 店舗単位のシフト確定・自動調整の排他制御。shiftsドメイン・auto_adjustドメインの両方から使われる。

import sqlite3

from models import db, AutoAdjustConfig
from sqlalchemy.exc import IntegrityError, OperationalError


class ShiftLockConflict(Exception):
    """店舗単位のシフト確定/自動調整ロックが既に他のリクエストに保持されている場合に送出する。"""
    pass


# PostgreSQLの `lock_not_available`（NOWAIT時にロックが取得できなかった場合のSQLSTATE）。
# 参考: https://www.postgresql.org/docs/current/errcodes-appendix.html
_POSTGRES_LOCK_NOT_AVAILABLE = "55P03"

# SQLiteのプライマリ結果コード（拡張コードは下位1バイトにこれらの値を含む）。
# 参考: https://www.sqlite.org/rescode.html
_SQLITE_BUSY = 5
_SQLITE_LOCKED = 6


def _is_sqlite_lock_error(error) -> bool:
    """sqlite3.Error（開発/テスト環境）が真のロック競合（BUSY/LOCKED、拡張コード含む）かどうかを判定する。
    同じ文言のメッセージを持つ非sqlite3例外まで誤って対象にしないよう、型そのものも確認する。"""
    if not isinstance(error, sqlite3.Error):
        return False
    code = getattr(error, "sqlite_errorcode", None)
    if code is None:
        return False
    return (code & 0xFF) in (_SQLITE_BUSY, _SQLITE_LOCKED)


def _is_lock_conflict(error: OperationalError) -> bool:
    """
    OperationalErrorがNOWAITによるロック競合かどうかを判定する。
    DB接続断・デッドロック等の他のOperationalErrorを誤ってロック競合（409）として
    扱うと実際の障害を隠蔽してしまうため、ロック競合であることをDB方言固有の
    情報から確認できた場合のみTrueを返す。
    """
    orig = getattr(error, "orig", None)
    if getattr(orig, "pgcode", None) == _POSTGRES_LOCK_NOT_AVAILABLE:
        return True
    return _is_sqlite_lock_error(orig)


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
        if _is_lock_conflict(e):
            raise ShiftLockConflict() from e
        raise
