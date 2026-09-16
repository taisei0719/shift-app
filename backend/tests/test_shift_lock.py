import sqlite3
from unittest.mock import patch

import pytest
from sqlalchemy.exc import OperationalError

from services.shift_lock import ShiftLockConflict, acquire_shop_shift_lock


class _FakePsycopgError(Exception):
    def __init__(self, pgcode=None, message="fake db error"):
        super().__init__(message)
        self.pgcode = pgcode


def _make_operational_error(orig):
    return OperationalError("SELECT 1", {}, orig)


def test_acquire_lock_raises_conflict_on_postgres_lock_not_available(app, make_shop):
    shop = make_shop()
    orig = _FakePsycopgError(pgcode="55P03")

    with patch(
        "services.shift_lock.AutoAdjustConfig.query"
    ) as mocked_query:
        mocked_query.filter_by.return_value.first.return_value = object()
        mocked_query.filter_by.return_value.with_for_update.return_value.one.side_effect = _make_operational_error(orig)

        with pytest.raises(ShiftLockConflict):
            acquire_shop_shift_lock(shop.id)


def test_acquire_lock_reraises_on_unrelated_operational_error(app, make_shop):
    """デッドロック・接続断等、ロック競合以外のOperationalErrorは409に丸めず再送出する。"""
    shop = make_shop()
    orig = _FakePsycopgError(pgcode="40P01")  # deadlock_detected

    with patch(
        "services.shift_lock.AutoAdjustConfig.query"
    ) as mocked_query:
        mocked_query.filter_by.return_value.first.return_value = object()
        mocked_query.filter_by.return_value.with_for_update.return_value.one.side_effect = _make_operational_error(orig)

        with pytest.raises(OperationalError):
            acquire_shop_shift_lock(shop.id)


def test_acquire_lock_raises_conflict_on_sqlite_database_locked(app, make_shop):
    """SQLite（開発/テスト環境）はSQLSTATEを持たないため、sqlite3.Errorのエラーコードで判定する。"""
    shop = make_shop()
    orig = sqlite3.OperationalError("database is locked")
    orig.sqlite_errorcode = 5  # SQLITE_BUSY

    with patch(
        "services.shift_lock.AutoAdjustConfig.query"
    ) as mocked_query:
        mocked_query.filter_by.return_value.first.return_value = object()
        mocked_query.filter_by.return_value.with_for_update.return_value.one.side_effect = _make_operational_error(orig)

        with pytest.raises(ShiftLockConflict):
            acquire_shop_shift_lock(shop.id)


def test_acquire_lock_reraises_non_sqlite_exception_with_locked_message(app, make_shop):
    """sqlite3.Error以外の例外が偶然"database is locked"を含んでいても、
    ロック競合とは判定せず再送出する（実際のDB障害を隠さないため）。"""
    shop = make_shop()
    orig = RuntimeError("database is locked")

    with patch(
        "services.shift_lock.AutoAdjustConfig.query"
    ) as mocked_query:
        mocked_query.filter_by.return_value.first.return_value = object()
        mocked_query.filter_by.return_value.with_for_update.return_value.one.side_effect = _make_operational_error(orig)

        with pytest.raises(OperationalError):
            acquire_shop_shift_lock(shop.id)
