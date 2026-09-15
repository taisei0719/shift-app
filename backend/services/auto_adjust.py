# backend/services/auto_adjust.py
# シフト自動調整のアルゴリズム・検証ロジック（PBI #40 / SBI #76）

import math
import random

from models import ShiftRejectionHistory
from services.position import UNSPECIFIED_POSITION
from services.rejection_history import get_current_year_month


def _parse_hour_float(t):
    # t: datetime.time -> float hour (e.g. 9:30 -> 9.5)
    return t.hour + t.minute / 60.0


def _normalize_capacities_map(capacities_map):
    """
    capacities_mapを新形式（ポジション別 {"<position>": {"<hour>": int}}）に正規化する。
    フロントエンド未対応期間（SBI #66未マージ時点）は旧形式のフラットな
    {"<hour>": int} がそのまま送られてくるため、値がdictでなければ
    UNSPECIFIED_POSITIONバケットの定員として扱う。
    """
    if not capacities_map:
        return {}
    if any(not isinstance(v, dict) for v in capacities_map.values()):
        return {UNSPECIFIED_POSITION: capacities_map}
    return capacities_map


def _is_valid_hour_capacity_dict(hour_caps):
    """{"<hour>": int} 形式（0〜23の整数キー・0以上の整数値）かどうかを検証する。
    bool は int のサブクラスのため明示的に除外し、小数値もint()での暗黙切り捨てを許さず拒否する。
    "1"と"01"のように正規化後に衝突するキーも、_get_position_capsでの黙った上書きを防ぐため拒否する。"""
    if not isinstance(hour_caps, dict):
        return False
    seen_hours = set()
    for hour_key, cap_value in hour_caps.items():
        if isinstance(cap_value, bool) or not isinstance(cap_value, int):
            return False
        try:
            hour = int(hour_key)
        except (TypeError, ValueError):
            return False
        if hour in seen_hours:
            return False
        seen_hours.add(hour)
        if not (0 <= hour <= 23) or cap_value < 0:
            return False
    return True


def _is_valid_capacities_map(capacities_map):
    """
    保存前のcapacitiesの形式検証。旧形式（フラット {"<hour>": int}）・
    新形式（ポジション別 {"<position>": {"<hour>": int}}）のいずれかであることを確認する。
    _normalize_capacities_mapは値の一部でもdict以外ならフラット扱いにするため、
    形式が混在したデータ（int()変換に失敗しcompute_auto_assignmentsが500になる）を弾く。
    """
    if not isinstance(capacities_map, dict):
        return False
    if not capacities_map:
        return True
    values_are_dicts = [isinstance(v, dict) for v in capacities_map.values()]
    if any(values_are_dicts) and not all(values_are_dicts):
        return False
    if all(values_are_dicts):
        return all(_is_valid_hour_capacity_dict(v) for v in capacities_map.values())
    return _is_valid_hour_capacity_dict(capacities_map)


# -------------------- 自動調整ロジック本体 --------------------
def compute_auto_assignments(request_shifts, priorities_map, capacities_map, shop_id=None):
    """
    シフト自動調整ロジック。
    優先度が同じグループ内では「累積棄却率が高い人」を優先することで
    長期的な棄却の偏りを防ぐ。

    Args:
        request_shifts: Shiftオブジェクトのリスト (shift_type=='request')
        priorities_map: {str(user_id): priority_int}
        capacities_map: {"<position>": {"0": int, ..., "23": int}} ポジション別・各時間帯の定員。
            positionが設定されていないシフトはUNSPECIFIED_POSITIONバケットで扱う。
        shop_id: 棄却履歴を参照するための店舗ID (Noneの場合は履歴を使わない)

    Returns:
        assignments: [{"user_id": int, "start_time": str, "end_time": str, "position": str|None}, ...]
        metrics: {
            "users": {user_id: {"accepted": int, "total": int, "rate": float}},
            "overall": {"accepted": int, "total": int, "rate": float}
        }
    """
    # --- 定員マップの準備（ポジション別） ---
    # capacities_map: {"<position>": {"<hour>": int}}。positionが空文字列("")のシフトはUNSPECIFIED_POSITIONバケットで扱う。
    # 対象positionのcapacitiesが未設定の場合は全時間帯上限なし（後方互換）。
    capacities_map = _normalize_capacities_map(capacities_map)
    position_caps = {}

    def _get_position_caps(position_key):
        if position_key not in position_caps:
            raw = (capacities_map or {}).get(position_key, {}) or {}
            caps = {int(k): int(v) for k, v in raw.items()}
            for h in range(24):
                caps.setdefault(h, 9999)  # 未設定時間帯は上限なし
            position_caps[position_key] = caps
        return position_caps[position_key]

    # --- 棄却履歴の取得 ---
    # shop_idがある場合のみDBから引く（シミュレーション時も参照する）
    rejection_rate_map = {}  # {user_id: float}
    if shop_id is not None:
        histories = ShiftRejectionHistory.query.filter_by(shop_id=shop_id).all()
        for h in histories:
            # 月次リセットが必要な場合は率を0扱いにする
            if h.reset_mode == 'monthly':
                current_ym = get_current_year_month()
                if h.last_reset_year_month != current_ym:
                    rejection_rate_map[h.user_id] = 0.0
                    continue
            rejection_rate_map[h.user_id] = h.rejection_rate

    # --- リクエストリストの構築 ---
    reqs = []
    for s in request_shifts:
        sf = _parse_hour_float(s.start_time)
        ef = _parse_hour_float(s.end_time)
        duration = max(0.25, ef - sf)
        priority = int(priorities_map.get(str(s.user_id), 0))
        rejection_rate = rejection_rate_map.get(s.user_id, 0.0)

        reqs.append({
            "user_id": s.user_id,
            "start_f": sf,
            "end_f": ef,
            "duration": duration,
            "priority": priority,
            "rejection_rate": rejection_rate,  # 棄却率 (高いほど優先)
            "rand": random.random(),            # 同率時のタイブレーク
            "position": s.position or UNSPECIFIED_POSITION,
            "shift": s,
        })

    # --- ソート ---
    # 1. 優先度 高い順
    # 2. 同優先度内: 累積棄却率 高い順（過去に多く棄却された人を優先）
    # 3. 同棄却率: ランダム（毎回同じ人が有利にならないように）
    reqs.sort(key=lambda r: (
        -r['priority'],
        -r['rejection_rate'],
        r['rand']
    ))

    # --- 貪欲法による割当 ---
    assignments = []
    accepted_count = {}  # {user_id: int}
    total_count = {}     # {user_id: int}

    for r in reqs:
        uid = r['user_id']
        total_count[uid] = total_count.get(uid, 0) + 1

        # シフトがカバーする時間帯スロット (開始時刻の整数部〜終了時刻の切り上げ-1)
        hours = list(range(int(r['start_f']), math.ceil(r['end_f'])))
        caps = _get_position_caps(r['position'])

        # 全時間帯でそのpositionの定員に空きがあるか確認
        can_assign = all(caps.get(h, 0) > 0 for h in hours)

        if can_assign:
            # 定員を消費
            for h in hours:
                caps[h] = caps.get(h, 0) - 1
            assignments.append({
                "user_id": uid,
                "start_time": r['shift'].start_time.strftime('%H:%M'),
                "end_time": r['shift'].end_time.strftime('%H:%M'),
                "position": r['shift'].position,
            })
            accepted_count[uid] = accepted_count.get(uid, 0) + 1

    # --- メトリクス計算 ---
    total_requests_all = sum(total_count.values())
    total_accepted_all = sum(accepted_count.values())

    metrics = {
        "users": {
            str(uid): {
                "accepted": accepted_count.get(uid, 0),
                "total": tot,
                "rate": accepted_count.get(uid, 0) / tot if tot > 0 else 0.0,
                "rejection_rate_before": round(rejection_rate_map.get(uid, 0.0), 4),
            }
            for uid, tot in total_count.items()
        },
        "overall": {
            "accepted": total_accepted_all,
            "total": total_requests_all,
            "rate": total_accepted_all / total_requests_all if total_requests_all > 0 else 0.0,
        }
    }

    return assignments, metrics
