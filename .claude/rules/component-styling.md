---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/components/**/*.ts"
  - "!frontend/src/components/ui/**/*"
  - "!**/*.test.{ts,tsx}"
---

# コンポーネントの外観

- 利用側は、コンポーネントの外観をそのコンポーネントが公開した props を通して変える

  ```
  OK:
  <Button variant="destructive" />
  NG:
  <Button className="bg-red-500" />
  <Button style={{ color: "red" }} />
  ```

- 利用側から変えられる外観は、コンポーネントの props として公開する
- 外観の差分を出す props は、`variant`・`size` か、外観の意味を表す名前の専用の props にする
- 外観の差分を出す props には、CSS クラスやスタイルの値でなく外観の意味を渡す
- 外観と振る舞いをひとまとまりで持つ UI は専用のコンポーネントにし、利用側はそのコンポーネントの props だけで使う
- `DESIGN.md` に意味が定義されていないトークン（shadcn/ui 由来の `chart-*`・`sidebar-*` など）を共通UIで使い始めるときは、同じ変更で `DESIGN.md` にその意味と使い分けを定義する
