# backend/models.py

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash # パスワードハッシュ化関数も移動
import secrets 
import random, string

# dbオブジェクトはここで初期化 (app.pyからappオブジェクトを受け取って設定するのが一般的だが、ここでは一旦dbだけ切り出す)
# 注意: dbオブジェクトの初期化はapp.pyで実行する必要があるため、models.pyでは定義のみ
db = SQLAlchemy() 

# -------------------- モデル定義 (移動) --------------------
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=True)
    # backref を 'users_in_shop' などに変えると混乱を避けやすいが、既存のまま
    shop = db.relationship("Shop", backref="users", uselist=False)   
    # 参加リクエスト用カラムを追加
    shop_request_code = db.Column(db.String(32), nullable=True) # 暫定的なリクエスト店舗コード

# Shiftモデル: シフトの希望や確定シフトを格納する
class Shift(db.Model):
    __tablename__ = 'shifts'
    id = db.Column(db.Integer, primary_key=True)
    
    # 外部キー
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    
    # シフト情報
    shift_date = db.Column(db.Date, nullable=False)  # シフトの日付 (YYYY-MM-DD)
    start_time = db.Column(db.Time, nullable=False) # 開始時刻 (HH:MM:SS)
    end_time = db.Column(db.Time, nullable=False)   # 終了時刻 (HH:MM:SS)
    
    # シフトの種類: 'request'(希望), 'confirmed'(確定), 'manual'(手動調整)
    shift_type = db.Column(db.String(20), nullable=False, default='request') 
    
    # Userモデルとのリレーション
    user = db.relationship('User', backref=db.backref('shifts', lazy=True))
    
    # 確定シフトの場合、誰が確定したか (今回はシンプルにするためスキップ)
    # confirmed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) 

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'shop_id': self.shop_id,
            'shift_date': self.shift_date.isoformat(),
            'start_time': self.start_time.strftime('%H:%M'), # 時間を H:M 形式で返す
            'end_time': self.end_time.strftime('%H:%M'),
            'shift_type': self.shift_type,
            'user_name': self.user.name,
        }

    # 複合インデックス: 同じユーザー、同じ日付に複数の確定済みシフトは持てないようにする
    __table_args__ = (
        db.UniqueConstraint('user_id', 'shift_date', name='_user_shift_date_uc'),
    )


class Shop(db.Model):
    __tablename__ = 'shops'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False) #現在は店舗名の重複を許可していない
    location = db.Column(db.String(200), nullable=True)
    shop_code = db.Column(db.String(32), unique=True, nullable=False)     # shop_codeを32桁に拡張
    
    # ユーティリティ関数をクラスメソッドとして定義（重複チェックのため）
    @staticmethod
    def generate_unique_code():
        import random, string
        while True:
            code = ''.join(random.choices(string.digits, k=6)) # 6桁で十分
            if not Shop.query.filter_by(shop_code=code).first():
                return code