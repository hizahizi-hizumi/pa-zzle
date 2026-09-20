---
paths:
  - "frontend/src/components/*.tsx"
  - "frontend/src/games/*/ui/**/*.tsx"
  - "frontend/src/records/ui/**/*.tsx"
  - "frontend/src/views/**/*.tsx"
---

# shadcn/ui の利用

- アプリ共通の一般UIでは、画面ごとの独自実装でトンマナ・操作感・状態表現を崩して利用者体験を損なわないよう、shadcn/ui への委譲を第一候補とする。
- 一般UIを実装するときは、まず既存の `frontend/src/components/ui/` と shadcn/ui の提供コンポーネントを確認する。
- 必要な一般UIの責務に対応する shadcn/ui コンポーネントがある場合は、それを使用し、同等のUIを標準HTML要素や独自コンポーネントで作り直さない。
- 必要なUIの責務は利用者体験と画面設計から決め、shadcn/ui の提供コンポーネントに合わせるためだけに、不要なUI・操作・状態を追加しない。
- 見出し・段落・リストなど、UIコンポーネントではなく文書構造として使う標準HTML要素は対象外とする。
- 盤面、セル、駒、ボトル、パズル固有の入力など、パズルの題材・ルール・操作に由来するUIには適用しない。
