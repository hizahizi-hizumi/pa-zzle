# Backend

pa-zzle の Backend 用ディレクトリです。

現時点ではアプリケーション構造をまだ決めていません。PoC を通して API 境界やドメイン構造を検証しながら決めます。

## 開発環境

Python の利用バージョンは `.python-version` を参照してください。

依存関係管理には uv を使用します。

```sh
uv sync --directory backend
```

品質検証コマンドはルートの `AGENTS.md` を参照してください。
