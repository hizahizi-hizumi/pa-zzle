---
paths:
  - "frontend/src/pages/**/*.{ts,tsx}"
  - "!frontend/src/pages/**/*.test.{ts,tsx}"
---

# Pages

- ファイル名、ディレクトリ階層、`index.tsx`、動的セグメントは URL・ルート構造を表すためだけに使う
- UI を描画するルートは、`frontend/src/views/` の View を default export するだけにする

  ```tsx
  OK:
  export { NanpurePlayView as default } from "@/views/NanpurePlayView";
  NG:
  export default function NanpurePlayPage() {
    const play = useNanpurePlay();

    return <NanpurePlay {...play} />;
  }
  ```

- UI を描画するルートごとに別の View を対応させる
- リダイレクトなど UI を描画しないルートは View を持たなくてよい
- ルーターが要求する特殊ファイル（`_app.tsx`・`404.tsx`）と特殊な名前の export（`Loader`・`Action`・`Pending`・`Catch`）には、ルーターとの接続に要る処理だけを置く
- ルートとして認識させる必要のないコンポーネント、hooks、定数、ヘルパーは `pages/` の外に置く
- ゲームのホームはゲームごとに `pages/puzzles/<game>/index.tsx` に置く

  ```text
  OK:
  pages/puzzles/nanpure/index.tsx
  NG:
  pages/puzzles/[game]/index.tsx
  ```
