# Frontend

パズル pa-zzle のフロントエンド。

PoC の画面構成やディレクトリ構成は先取りせず、React アプリとして起動・検証できる最小構成にしている。

Biome、Tailwind CSS、shadcn/ui の設定と既存 UI 部品は、後続実装で利用できる開発資産として保持している。これらを採用していること自体から、PoC の画面構成やコンポーネント設計を固定しない。

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
