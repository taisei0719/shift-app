# backend ディレクトリ構成

Flask製バックエンド。PBI #40（app.py分割）により、ドメインごとのBlueprintと共有ロジックの切り出しが完了している。

```
backend/
  app.py               # アプリ初期化（Flask/DB/JWT/CORS設定）、Blueprint登録、
                        # JWTエラーハンドリング、DB初期化処理（ドメインエンドポイントは含まない）
  extensions.py          # app.pyとBlueprintの両方から参照するFlask拡張のインスタンス（Limiter等）。
                          # 循環importを避けるため、インスタンス化のみここで行いinit_app(app)はapp.py側で呼ぶ
  models.py             # SQLAlchemyモデル定義
  services/             # ドメイン横断で使われる純粋なビジネスロジック（Flaskのroute/requestに依存しない）
    shift_lock.py        # 店舗単位のシフト確定・自動調整の排他制御（ShiftLockConflict等）
    rejection_history.py # 棄却履歴の取得・更新ロジック
    position.py           # ポジション関連の共有定数（UNSPECIFIED_POSITION）。shops/auto_adjust両ドメインが参照
    auto_adjust.py         # シフト自動調整のアルゴリズム・検証ロジック（compute_auto_assignments等）
  blueprints/            # ドメインごとのFlask Blueprint（1ファイル1ドメイン、対応するエンドポイント群）
    rejection_history.py # 棄却履歴の閲覧・リセット関連エンドポイント
    auth.py               # 登録・ログイン・ログアウト・セッション・アカウント編集/削除
    shops.py               # 店舗登録・参加リクエスト・店舗詳細・従業員一覧・ポジション更新
    shifts.py              # シフト希望提出・確定・取得（submit_request, admin/shifts系, 月次取得等）
    auto_adjust.py          # 自動調整の設定取得/保存・自動調整実行
  tests/                 # pytest。テストファイルは概ねドメイン単位で対応させる
```

## 分割方針（PBI #40）

- `app.py`が肥大化していたため、ドメインごとに`blueprints/`配下のBlueprintへ切り出した。
- 複数ドメインから使われる共有ロジックは`services/`に置き、`blueprints/`側からimportして使う。
- app.pyとBlueprintの両方が参照するFlask拡張（Limiter等）は`extensions.py`に置き、循環importを避ける。
- 分割はエンドポイントのURL・振る舞いを変えない後方互換リファクタとして行う。
- 切り出し済み: `rejection_history`ドメイン（#72）、`auth`ドメイン（#73）、`shops`ドメイン（#74）、`shifts`ドメイン（#75）、`auto_adjust`ドメイン（#76）。`app.py`にはアプリ初期化・JWTエラーハンドリング・DB初期化処理のみが残る。
