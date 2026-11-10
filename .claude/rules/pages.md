---
paths:
  - "frontend/src/pages/**/*.{ts,tsx}"
  - "!frontend/src/pages/**/*.test.{ts,tsx}"
---

# Pages

- `pages/` の下のディレクトリ名とファイル名は、`index.tsx`・`_app.tsx`・`404.tsx` を除き URL のセグメントにする
- `_app.tsx`・`404.tsx` と、`Loader`・`Action`・`Pending`・`Catch` の export には、ルーターの API（`useMatches`・`useParams`・`Outlet` など）から得た値の解釈と、`pages/` の外のコンポーネントへの受け渡しだけを書く
- `_app.tsx` を除き、UI を描画するルートは `frontend/src/views/` の View を default export するだけにする

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
- リダイレクトするルートは、ルートファイルにリダイレクトだけを書く
- ルートでないコンポーネント・hooks・定数・ヘルパーのファイルは `pages/` の外に置く
- ゲームのホームはゲームごとに `pages/puzzles/<game>/index.tsx` に置く

  ```text
  OK:
  pages/puzzles/nanpure/index.tsx
  NG:
  pages/puzzles/[game]/index.tsx
  ```
