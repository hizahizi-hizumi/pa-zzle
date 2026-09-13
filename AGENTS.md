## 実行コマンド

### リポジトリ全体

```sh
./scripts/verify.sh # 現時点の全品質検証
```

### Frontend

```sh
bun --cwd frontend run dev # 開発サーバー起動
bun --cwd frontend run check # Biome のチェック
bun --cwd frontend run typecheck # TypeScript の型検査
bun --cwd frontend run test # Vitest の1回実行
bun --cwd frontend run build # プロダクションビルド
```

### Backend（実装開始後）

```sh
uv run --directory backend pytest # pytest のテスト実行
uv run --directory backend mypy . # mypy の型チェック
uv run --directory backend ruff check . # Ruff の静的解析
```
