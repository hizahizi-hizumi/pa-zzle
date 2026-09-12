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
