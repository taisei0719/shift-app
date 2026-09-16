# backend/extensions.py
# app.pyとBlueprintの両方から参照するFlask拡張のインスタンス。
# 循環importを避けるため、Limiterのインスタンス化のみここで行い、init_app(app)はapp.py側で呼ぶ。

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
