import pandas as pd
from ortools.sat.python import cp_model



# ----------------------------
# データ読み込み
# ----------------------------
INPUT_CSV = "scripts/sample_data.csv"
OUTPUT_CSV = "scripts/shift_result.csv"

df = pd.read_csv(INPUT_CSV)
days = sorted(df["日付"].unique())
slots = sorted(df["時間帯"].unique())
staff = df.columns[2:]

model = cp_model.CpModel()

# ----------------------------
# 設定
# ----------------------------

DEFAULT_REQ = [2, 2, 2]  # 午前・午後・夜に各2人
REQUIRED_STAFF_PER_SLOT = {d: DEFAULT_REQ for d in days}

MAX_SLOTS_PER_STAFF_WEEK = 5    # 週合計の最大勤務枠
MAX_SLOTS_PER_STAFF_DAY = 2     # 1日あたりの最大勤務枠

# ----------------------------
# 変数作成
# ----------------------------
shift = {}
for idx, row in df.iterrows():
    d = row["日付"]
    s_idx = list(slots).index(row["時間帯"])
    for st in staff:
        if row[st] == "◯":
            shift[(d, s_idx, st)] = model.NewBoolVar(f"shift_{d}_{s_idx}_{st}")
        else:
            shift[(d, s_idx, st)] = model.NewConstant(0)

# ----------------------------
# 制約1: 各時間帯の必要人数
# ----------------------------
for d in days:
    for s_idx, req in enumerate(REQUIRED_STAFF_PER_SLOT[d]):
        model.Add(sum(shift[(d, s_idx, st)] for st in staff) == req)

# ----------------------------
# 制約2: スタッフの週最大勤務枠数
# ----------------------------
for st in staff:
    model.Add(sum(shift[(d, s_idx, st)] for d in days for s_idx in range(len(slots))) <= MAX_SLOTS_PER_STAFF_WEEK)

# ----------------------------
# 制約3: スタッフの1日最大勤務枠数
# ----------------------------
for st in staff:
    for d in days:
        model.Add(sum(shift[(d, s_idx, st)] for s_idx in range(len(slots))) <= MAX_SLOTS_PER_STAFF_DAY)

# ----------------------------
# 解く
# ----------------------------
solver = cp_model.CpSolver()
status = solver.Solve(model)

# ----------------------------
# 結果出力
# ----------------------------
if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
    df_result = df.copy()
    for idx, row in df_result.iterrows():
        d = row["日付"]
        s_idx = list(slots).index(row["時間帯"])
        for st in staff:
            df_result.loc[idx, st] = "出勤" if solver.Value(shift[(d, s_idx, st)]) == 1 else "-"
    df_result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"結果を {OUTPUT_CSV} に保存しました。")
else:
    print("制約条件を満たすシフトが見つかりませんでした。")
