import pandas as pd
from ortools.sat.python import cp_model

# ----------------------------
# 設定
# ----------------------------

INPUT_CSV = "scripts/sample_data.csv"
OUTPUT_CSV = "scripts/shift_result.csv"

# 1日ごとの必要人数（index=0は1日目）
# 例：1日目2人、2日目2人、3日目2人
REQUIRED_STAFF_PER_DAY = [2, 2, 2]

# スタッフごとの最大勤務日数
MAX_DAYS_PER_STAFF = {
    "山田": 2,
    "佐藤": 2,
    "鈴木": 2
}

# ----------------------------
# データ読み込み
# ----------------------------
df = pd.read_csv(INPUT_CSV)
days = df["日付"].tolist()
staff = df.columns[1:]

# ----------------------------
# モデル作成
# ----------------------------
model = cp_model.CpModel()

# 変数作成: shift[(day, staff)] = 1 if 出勤
shift = {}
for d in range(len(days)):
    for s in staff:
        if df.loc[d, s] == "◯":  # 勤務可能
            shift[(d, s)] = model.NewBoolVar(f"shift_{d}_{s}")
        else:  # 勤務不可の場合は0固定
            shift[(d, s)] = model.NewConstant(0)

# ----------------------------
# 制約1: 各日ごとの必要人数
# ----------------------------
for d in range(len(days)):
    model.Add(sum(shift[(d, s)] for s in staff) == REQUIRED_STAFF_PER_DAY[d])

# ----------------------------
# 制約2: スタッフごとの最大勤務日数
# ----------------------------
for s in staff:
    max_days = MAX_DAYS_PER_STAFF.get(s, len(days))
    model.Add(sum(shift[(d, s)] for d in range(len(days))) <= max_days)

# ----------------------------
# 解く
# ----------------------------
solver = cp_model.CpSolver()
status = solver.Solve(model)

# ----------------------------
# 結果出力
# ----------------------------
if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
    result = df.copy()
    for d in range(len(days)):
        for s in staff:
            result.loc[d, s] = "出勤" if solver.Value(shift[(d, s)]) == 1 else "-"
    print(result)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\n結果を {OUTPUT_CSV} に保存しました。")
else:
    print("制約条件を満たすシフトが見つかりませんでした。")
