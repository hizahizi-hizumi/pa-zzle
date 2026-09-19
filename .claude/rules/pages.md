---
paths:
  - "frontend/src/pages/**/*.tsx"
---

# Pages

- `pages/` は、ルーターにURL・ルート構造を認識させるためだけに使用する。
- ファイル名、ディレクトリ階層、`index.tsx`、動的セグメントは、URL・ルート構造を表すためだけに使用する。
- UIを描画する通常のルートは、そのルート専用のViewをdefault exportする。
- 1つのUI描画ルートに1つの専用Viewを対応させ、同じViewを複数ルートから直接利用しない。
- リダイレクトなどUIを描画しないルートにはViewを要求しない。
- ルーターが要求する特殊ファイルやexportには、ルーターとの接続に必要な処理だけを置く。
- `pages/` 配下には、ルートとして認識させる必要のないコンポーネント、hooks、定数、ヘルパーなどの実装ファイルを置かない。

```tsx
// OK: URLとViewの対応だけを表す
export { NanpurePlayView as default } from "@/views/NanpurePlayView";
```

```tsx
// NG: pages配下に画面実装を持つ
export default function NanpurePlayPage() {
  const play = useNanpurePlay();

  return <NanpurePlay {...play} />;
}
```
