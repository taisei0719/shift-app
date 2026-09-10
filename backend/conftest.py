import atexit
import os
import tempfile
from datetime import time

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-32-bytes-minimum")

import pytest
from werkzeug.security import generate_password_hash

from app import app as flask_app
from models import db as _db, Shop, User


def _cleanup_test_db():
    # SQLAlchemyの接続プールがファイルを掴んだままだとWindowsでunlinkが失敗するため、
    # 先にengineをdisposeして全接続を閉じてから削除する。
    try:
        with flask_app.app_context():
            _db.engine.dispose()
    except Exception:
        pass
    try:
        if os.path.exists(_db_path):
            os.unlink(_db_path)
    except OSError:
        pass


atexit.register(_cleanup_test_db)


@pytest.fixture()
def app():
    flask_app.config.update(TESTING=True)
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def db_session(app):
    return _db.session


@pytest.fixture()
def make_shop(db_session):
    counter = {"n": 0}

    def _make_shop(name=None, shop_code=None):
        counter["n"] += 1
        shop = Shop(
            name=name or f"Test Shop {counter['n']}",
            shop_code=shop_code or f"{counter['n']:06d}",
            open_time=time(9, 0),
            close_time=time(22, 0),
        )
        db_session.add(shop)
        db_session.commit()
        return shop

    return _make_shop


@pytest.fixture()
def make_user(db_session):
    def _make_user(name="staff", email="staff@example.com", password="password123", role="staff", shop=None):
        user = User(
            name=name,
            email=email,
            role=role,
            password=generate_password_hash(password),
            shop_id=shop.id if shop else None,
        )
        db_session.add(user)
        db_session.commit()
        return user

    return _make_user


@pytest.fixture()
def auth_header(client):
    def _login(email, password):
        res = client.post("/api/login", json={"identifier": email, "password": password})
        assert res.status_code == 200, res.get_json()
        token = res.get_json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login
