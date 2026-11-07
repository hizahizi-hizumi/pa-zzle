---
paths:
  - "frontend/src/components/**/*.tsx"
  - "frontend/src/games/*/ui/**/*.tsx"
  - "frontend/src/records/ui/**/*.tsx"
  - "frontend/src/zukan/ui/**/*.tsx"
  - "frontend/src/views/**/*.tsx"
  - "!frontend/src/components/ui/**/*"
  - "!**/*.test.tsx"
---

# shadcn/ui の利用

- パズル固有でない一般UIを作る前に、`frontend/src/components/ui/` と shadcn/ui の提供コンポーネントから、その UI の役割に当たるものを探す
- 役割に当たる shadcn/ui のコンポーネントがある一般UIは、そのコンポーネントで作る

  ```
  OK:
  <Button onClick={retry}>もう一度</Button>
  NG:
  <button className="rounded-md bg-primary px-4" onClick={retry}>もう一度</button>
  ```

- 一般UIに置く UI・操作・状態は、利用者体験と `docs/プロダクト/画面/` の該当する画面の文書から決めたものだけにする
- 見出し・段落・リストなど、文書の構造に使う標準HTML要素には、このルールを当てない
- 盤面・セル・駒・ボトル・パズル固有の入力など、パズルの題材・ルール・操作に由来する UI には、このルールを当てない
