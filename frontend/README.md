# Frontend

パズル pa-zzle のフロントエンド。

現時点では、PoC の画面構成やディレクトリ構成を先取りせず、React アプリとして起動・検証できる最小構成だけを置いている。

## セットアップ

Bun はリポジトリルートの `.bun-version` に固定している。

```sh
bun install
```

## 開発

```sh
bun run dev
```

## 検証

```sh
bun run check
bun run typecheck
bun run test
bun run build
```
