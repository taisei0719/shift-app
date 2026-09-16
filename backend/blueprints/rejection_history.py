# backend/blueprints/rejection_history.py
# 棄却履歴の閲覧・リセット関連エンドポイント（Admin専用）

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User, ShiftRejectionHistory
from services.rejection_history import get_current_year_month

rejection_history_bp = Blueprint("rejection_history", __name__)


# -------------------- API: 棄却履歴一覧取得 (Admin専用) --------------------
@rejection_history_bp.route("/api/shop/<int:shop_id>/rejection_history", methods=["GET"])
@jwt_required()
def get_rejection_history(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)

    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
    return jsonify({"histories": [h.to_dict() for h in histories]}), 200


# -------------------- API: 棄却履歴リセット (Admin専用) --------------------
# reset_type: 'all' (全員リセット) / 'user' (特定ユーザーのみ)
@rejection_history_bp.route("/api/shop/<int:shop_id>/rejection_history/reset", methods=["POST"])
@jwt_required()
def reset_rejection_history(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)

    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    reset_type = data.get("reset_type", "all")   # 'all' or 'user'
    target_user_id = data.get("user_id")          # reset_type='user' の場合に必要
    current_ym = get_current_year_month()

    try:
        if reset_type == "all":
            # 店舗の全スタッフをリセット
            histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
            for h in histories:
                h.total_requests = 0
                h.total_accepted = 0
                h.last_reset_year_month = current_ym
            db.session.commit()
            return jsonify({"message": f"{len(histories)}件の履歴をリセットしました。"}), 200

        elif reset_type == "user":
            if not target_user_id:
                return jsonify({"error": "user_idが必要です"}), 400
            history = ShiftRejectionHistory.query.filter_by(
                shop_id=shop_id, user_id=target_user_id
            ).first()
            if not history:
                return jsonify({"error": "履歴が見つかりません"}), 404
            history.total_requests = 0
            history.total_accepted = 0
            history.last_reset_year_month = current_ym
            db.session.commit()
            return jsonify({"message": "履歴をリセットしました。"}), 200

        else:
            return jsonify({"error": "reset_typeは 'all' または 'user' を指定してください"}), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("棄却履歴リセット中にエラーが発生しました")
        return jsonify({"error": "リセット中にエラーが発生しました"}), 500


# -------------------- API: リセットモード変更 (Admin専用) --------------------
# reset_mode: 'manual' or 'monthly'
@rejection_history_bp.route("/api/shop/<int:shop_id>/rejection_history/reset_mode", methods=["POST"])
@jwt_required()
def update_reset_mode(shop_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    user = db.session.get(User, user_id)

    if not user or user.role != 'admin' or user.shop_id != shop_id:
        return jsonify({"error": "権限がありません"}), 403

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "リクエスト本文はJSONオブジェクトで指定してください"}), 400
    new_mode = data.get("reset_mode")
    target_user_id = data.get("user_id")  # Noneなら全員まとめて変更

    if new_mode not in ('manual', 'monthly'):
        return jsonify({"error": "reset_modeは 'manual' または 'monthly' を指定してください"}), 400

    try:
        query = ShiftRejectionHistory.query.filter_by(shop_id=shop_id)
        if target_user_id:
            query = query.filter_by(user_id=target_user_id)

        histories = query.all()
        for h in histories:
            h.reset_mode = new_mode

        db.session.commit()
        return jsonify({
            "message": f"{len(histories)}件のリセットモードを '{new_mode}' に変更しました。"
        }), 200

    except Exception:
        db.session.rollback()
        current_app.logger.exception("リセットモード更新中にエラーが発生しました")
        return jsonify({"error": "更新中にエラーが発生しました"}), 500
