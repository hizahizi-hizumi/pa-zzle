# Backend

パズル pa-zzle のバックエンド実装領域。

現時点では Python の開発・検証環境だけを用意しており、PoC で判断する API、ドメイン、永続化などの構造は先取りしていない。

## Python

利用する Python は `.python-version` に固定している。依存関係は uv で管理する。

```sh
uv sync
```

## 検証

実装追加後は以下を利用する。

```sh
uv run pytest
uv run mypy .
uv run ruff check .
```
