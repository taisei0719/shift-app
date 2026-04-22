# backend/models.py

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
import secrets 
import random, string
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime

db = SQLAlchemy() 

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=True)
    shop = db.relationship("Shop", backref="users", uselist=False)   
    shop_request_code = db.Column(db.String(32), nullable=True)
    total_priority = db.Column(db.Integer, default=3, nullable=False)


class Shift(db.Model):
    __tablename__ = 'shifts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    shift_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    shift_type = db.Column(db.String(20), nullable=False, default='request') 
    user = db.relationship('User', backref=db.backref('shifts', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'shop_id': self.shop_id,
            'shift_date': self.shift_date.isoformat(),
            'start_time': self.start_time.strftime('%H:%M'),
            'end_time': self.end_time.strftime('%H:%M'),
            'shift_type': self.shift_type,
            'user_name': self.user.name,
        }


class Shop(db.Model):
    __tablename__ = 'shops'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    location = db.Column(db.String(200), nullable=True)
    shop_code = db.Column(db.String(32), unique=True, nullable=False)
    open_time = db.Column(db.Time, nullable=False, default=db.func.time(9, 0))
    close_time = db.Column(db.Time, nullable=False, default=db.func.time(22, 0))
    
    @staticmethod
    def generate_unique_code():
        import random, string
        while True:
            code = ''.join(random.choices(string.digits, k=6))
            if not Shop.query.filter_by(shop_code=code).first():
                return code


class AutoAdjustConfig(db.Model):
    __tablename__ = 'auto_adjust_configs'
    id = db.Column(db.Integer, primary_key=True)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), unique=True, nullable=False)
    priorities = db.Column(JSON, nullable=False, default={})
    capacities = db.Column(JSON, nullable=False, default={})
    options = db.Column(JSON, nullable=True)

    shop = db.relationship('Shop', backref=db.backref('auto_adjust_config', uselist=False))


# -------------------- 新規追加: 棄却履歴テーブル --------------------
class ShiftRejectionHistory(db.Model):
    """
    スタッフごとのシフト希望採用/棄却の累積履歴。
    自動調整の優先順位付けに使用する。
    
    reset_mode:
        'manual' → 管理者が手動でリセットするまで累積
        'monthly' → 毎月1日に自動リセット（reset_month で管理）
    """
    __tablename__ = 'shift_rejection_histories'

    id = db.Column(db.Integer, primary_key=True)

    # どのスタッフの、どの店舗の履歴か
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)

    # 累積カウント
    total_requests = db.Column(db.Integer, nullable=False, default=0)  # 累計シフト提出数
    total_accepted = db.Column(db.Integer, nullable=False, default=0)  # 累計採用数

    # リセット設定
    # 'manual': 手動リセットのみ / 'monthly': 月次自動リセット
    reset_mode = db.Column(db.String(20), nullable=False, default='manual')

    # 月次リセット用: 最後にリセットした年月を記録 (例: 2025-10)
    # これと現在の年月を比較して、月が変わっていたら自動リセットする
    last_reset_year_month = db.Column(db.String(7), nullable=True)

    # タイムスタンプ
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    user = db.relationship('User', backref=db.backref('rejection_histories', lazy=True))
    shop = db.relationship('Shop', backref=db.backref('rejection_histories', lazy=True))

    # 同じ(user_id, shop_id)の組み合わせは1レコードのみ
    __table_args__ = (
        db.UniqueConstraint('user_id', 'shop_id', name='_user_shop_rejection_uc'),
    )

    @property
    def rejection_rate(self):
        """棄却率を返す (0.0 〜 1.0)"""
        if self.total_requests == 0:
            return 0.0
        return (self.total_requests - self.total_accepted) / self.total_requests

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'shop_id': self.shop_id,
            'total_requests': self.total_requests,
            'total_accepted': self.total_accepted,
            'total_rejected': self.total_requests - self.total_accepted,
            'rejection_rate': round(self.rejection_rate, 4),
            'reset_mode': self.reset_mode,
            'last_reset_year_month': self.last_reset_year_month,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }