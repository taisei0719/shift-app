import pandas as pd
from ortools.sat.python import cp_model

# データ読み込み
df = pd.read_csv("scripts/sample_data.csv")
days = df["日付"].tolist()
staff = df.columns[1:]

model = cp_model.CpModel()

# 変数: shift[(day, staff)] = 1 if 出勤
shift = {}
for d in range(len(days)):
    for s in staff:
        if df.loc[d, s] == "◯":  # 勤務可能
            shift[(d, s)] = model.NewBoolVar(f"shift_{d}_{s}")
        else:  # 勤務不可の場合は常に0
            shift[(d, s)] = model.NewConstant(0)

# 制約: 各日2人勤務
for d in range(len(days)):
    model.Add(sum(shift[(d, s)] for s in staff) == 2)

# 解く
solver = cp_model.CpSolver()
solver.Solve(model)

# 結果出力
result = df.copy()
for d in range(len(days)):
    for s in staff:
        result.loc[d, s] = "出勤" if solver.Value(shift[(d, s)]) == 1 else "-"
print(result)

# CSVに保存
result.to_csv("scripts/shift_result.csv", index=False, encoding="utf-8-sig")
