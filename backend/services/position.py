# backend/services/position.py
# ポジション関連で複数ドメイン（shops, auto_adjust）から共有される定数。

# positionが設定されていないシフト・従業員の定員チェックに使う予約語バケットキー。
# ユーザーが自身のpositionとしてこの値を設定することはできない（shopsドメインでバリデーション）。
UNSPECIFIED_POSITION = "unspecified"
