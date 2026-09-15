# backend/blueprints/auto_adjust.py
# 自動調整の設定取得/保存・自動調整実行エンドポイント（PBI #40 / SBI #76）

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import SQLAlchemyError

from models import db, User, Shift, AutoAdjustConfig
from services.shift_lock import ShiftLockConflict, acquire_shop_shift_lock
from services.auto_adjust import compute_auto_assignments, _is_valid_capacities_map

auto_adjust_bp = Blueprint("auto_adjust", __name__)


# -------------------- API: 自動調整の設定取得/保存 (Admin専用) --------------------
@auto_adjust_bp.route("/api/shop/<int:shop_id>/auto_adjust/config", methods=["GET", "POST"])
@jwt_required()
def shop_auto_adjust_config(shop_id):
    # JWTからユーザー取得
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    # 権限と店舗一致チェック（管理者のみ）
    if user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    if request.method == 'GET':
        cfg = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()
        if not cfg:
            return jsonify({"config": {"priorities": {}, "capacities": {}}}), 200
        return jsonify({"config": {"priorities": cfg.priorities or {}, "capacities": cfg.capacities or {}, "options": cfg.options or {}}}), 200

    # POST: 保存
    # ボディなし・JSON null・非オブジェクトはいずれもrequest.jsonがNoneまたは非dictになるため、
    # 空設定として黙って保存せず一律400で拒否する
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    priorities = data.get("priorities", {})
    capacities = data.get("capacities", {})
    options = data.get("options", {})

    if not _is_valid_capacities_map(capacities):
        return jsonify({"error": "capacitiesの形式が不正です"}), 400

    try:
        cfg = AutoAdjustConfig.query.filter_by(shop_id=shop_id).first()
        if not cfg:
            cfg = AutoAdjustConfig(shop_id=shop_id, priorities=priorities, capacities=capacities, options=options)
            db.session.add(cfg)
        else:
            cfg.priorities = priorities
            cfg.capacities = capacities
            cfg.options = options
        db.session.commit()
        return jsonify({"message": "設定を保存しました"}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": f"保存に失敗したで: {str(e)}"}), 500


# -------------------- API: 指定日のシフトを自動調整して確定 (Admin専用) --------------------
@auto_adjust_bp.route("/api/admin/shifts/auto_adjust/<date_str>", methods=["POST"])
@jwt_required()
def admin_auto_adjust(date_str):
    """
    POST body: { "apply": true/false }
    - apply=false: シミュレーション結果を返すだけ
    - apply=true: DBに確定として保存（既存の該当ユーザー分のシフトは上書き）
    """
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    if user.role != 'admin' or not user.shop_id:
        return jsonify({"error": "権限がありません"}), 403

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "日付の形式が不正です (YYYY-MM-DD)"}), 400

    apply_flag = bool(request.json.get('apply', False)) if request.json else False

    if apply_flag:
        # 割当計算の元になるデータ取得より前にロックを取得し、
        # 「読み取り→計算→書き込み」の一連の処理全体を他リクエストと排他にする
        try:
            acquire_shop_shift_lock(user.shop_id)
        except ShiftLockConflict:
            return jsonify({"error": "他の管理者がシフト確定処理中です。しばらくしてから再度お試しください。"}), 409

    # 取得: その日の全ての request シフト
    request_shifts = Shift.query.filter(
        Shift.shop_id == user.shop_id,
        Shift.shift_date == target_date,
        Shift.shift_type == 'request'
    ).all()

    # 設定を取得
    cfg = AutoAdjustConfig.query.filter_by(shop_id=user.shop_id).first()
    priorities = cfg.priorities if cfg else {}
    capacities = cfg.capacities if cfg else {}

    assignments, metrics = compute_auto_assignments(request_shifts, priorities, capacities)

    if apply_flag:
        # DB更新: 指定ユーザーに対する既存シフトを削除して確定を追加する
        try:
            # 削除対象ユーザーID一覧
            user_ids = list({a['user_id'] for a in assignments})
            if user_ids:
                # delete existing confirmed/request for these users on that date (overwrite)
                Shift.query.filter(
                    Shift.shop_id == user.shop_id,
                    Shift.shift_date == target_date,
                    Shift.user_id.in_(user_ids)
                ).delete(synchronize_session='fetch')
            # insert new confirmed
            for a in assignments:
                st = datetime.strptime(a['start_time'], '%H:%M').time()
                et = datetime.strptime(a['end_time'], '%H:%M').time()
                new_shift = Shift(
                    user_id=a['user_id'],
                    shop_id=user.shop_id,
                    shift_date=target_date,
                    start_time=st,
                    end_time=et,
                    position=a.get('position'),
                    shift_type='confirmed'
                )
                db.session.add(new_shift)
            db.session.commit()
            return jsonify({"message": "自動確定を適用しました", "assignments": assignments, "metrics": metrics}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"適用に失敗しました: {str(e)}"}), 500

    return jsonify({"assignments": assignments, "metrics": metrics}), 200
