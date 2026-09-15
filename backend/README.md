# backend ディレクトリ構成

Flask製バックエンド。PBI #40（app.py分割）に伴い、ドメインごとのBlueprintと共有ロジックの切り出しを段階的に進めている。

```
backend/
  app.py               # アプリ初期化（Flask/DB/JWT/CORS設定）、Blueprint登録、
                        # まだBlueprint化されていないエンドポイント・DB初期化処理
  models.py             # SQLAlchemyモデル定義
  services/             # ドメイン横断で使われる純粋なビジネスロジック（Flaskのroute/requestに依存しない）
    shift_lock.py        # 店舗単位のシフト確定・自動調整の排他制御（ShiftLockConflict等）
    rejection_history.py # 棄却履歴の取得・更新ロジック
  blueprints/            # ドメインごとのFlask Blueprint（1ファイル1ドメイン、対応するエンドポイント群）
    rejection_history.py # 棄却履歴の閲覧・リセット関連エンドポイント
  tests/                 # pytest。テストファイルは概ねドメイン単位で対応させる
```

## 分割方針（PBI #40）

- `app.py`が肥大化していたため、ドメインごとに`blueprints/`配下のBlueprintへ段階的に切り出している（進行中）。
- 複数ドメインから使われる共有ロジックは`services/`に置き、`blueprints/`側からimportして使う。
- 分割はエンドポイントのURL・振る舞いを変えない後方互換リファクタとして行う。
- 現在切り出し済み: `rejection_history`ドメイン（#72）。今後 `auth`（#73）、`shops`（#74）、`shifts`（#75）、`auto_adjust`（#76）の順で切り出し予定（詳細は各SBI issue参照）。
