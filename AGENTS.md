## 実行コマンド

### リポジトリ全体

```sh
./scripts/verify.sh # 現時点の全品質検証
```

### Frontend

```sh
bun run --cwd frontend dev # 開発サーバー起動
bun run --cwd frontend check # Biome のチェック
bun run --cwd frontend typecheck # TypeScript の型検査
bun run --cwd frontend test # Vitest の1回実行
bun run --cwd frontend build # プロダクションビルド
```

### Backend

```sh
uv run --directory backend pytest # pytest のテスト実行
uv run --directory backend mypy . # mypy の型チェック
uv run --directory backend ruff check . # Ruff の静的解析
```