---
paths:
  - "frontend/src/components/*.tsx"
  - "frontend/src/games/*/ui/**/*.tsx"
  - "frontend/src/records/ui/**/*.tsx"
  - "frontend/src/views/**/*.tsx"
---

# shadcn/ui の利用

- 必要なUIの責務は利用者体験と画面設計から決め、shadcn/ui の提供コンポーネントに合わせるためだけに、不要なUI・操作・状態を追加しない。
- 一般UIを実装するときは、既存の `frontend/src/components/ui/` と shadcn/ui の提供コンポーネントを確認する。
- 必要な一般UIの責務に対応する shadcn/ui コンポーネントがある場合は、それを使用し、同等のコンポーネントを自作しない。
- HTML標準要素を直接使用するだけの場合は、同等コンポーネントの自作とは扱わない。
- 盤面、セル、駒、ボトル、パズル固有の入力など、パズルの題材・ルール・操作に由来するUIには適用しない。
