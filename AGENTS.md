# pa-zzle

複数種類のパズルを遊び、問題生成・難易度・プレイ成績を扱うウェブアプリ。

## 実行コマンド

### Frontend

```sh
bun --cwd frontend run dev # 開発サーバー起動
bun --cwd frontend run build # プロダクションビルド
bun --cwd frontend run lint # Biome のチェック
bun --cwd frontend run test # Vitest のテスト実行
```

### Backend

```sh
uv run --directory backend pytest # pytest のテスト実行
uv run --directory backend mypy . # mypy の型チェック
uv run --directory backend ruff check . # Ruff の静的解析
```

## 文書

- `docs/立ち上げ/`: 現在のPoC方針・アプリ概要・調査資料。PoCの要件や方向性を扱うときに参照する。
- `docs/adr/`: 意思決定の背景・比較・理由を残す。ADRだけを現在仕様の正本として扱わない。
- `docs/メモ/`: 開発上の参考資料。現在仕様の正本として扱わない。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`をmerge commitで取り込む。コンフリクトしていなければ取り込まない。
