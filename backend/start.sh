#!/bin/bash
python -c "from app import app, init_db; with app.app_context(): init_db()"

exec gunicorn -w 4 -b 0.0.0.0:${PORT} app:app