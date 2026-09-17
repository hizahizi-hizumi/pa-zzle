---
paths:
  - "frontend/src/**/*.tsx"
---

# コンポーネントの外観契約

- コンポーネントが所有する外観を、利用側から `className` や `style` で上書きしない。
- 利用側から変更可能にする外観は、コンポーネントの公開APIとして明示する。
- 意味のある外観差分は、`variant`、`size`、意味を表す専用propsなど、そのコンポーネントに適した公開APIで表現する。
- 外観と振る舞いをひとまとまりのUIとして所有させる場合は専用コンポーネントへ分離し、利用側に実装詳細を持たせない。
- 公開APIは外観の意味を表現し、CSSクラスや具体的なスタイル値を利用側へ漏らさない。
- 共通コンポーネントを利用するコードは、その公開APIを迂回して外観を変更しない。
- UI・デザインを変更するときは `DESIGN.md` を読み、正確なデザイントークン値が必要な場合は `frontend/styles/globals.css` の `@theme` を参照する。

## 例

```tsx
// 外観差分は公開APIにする
<Button className="bg-red-500" /> // NG
<Button variant="destructive" /> // OK

// 独立したUIは利用側で組み立てない
<div className="...">...</div> // NG
<GameCard game={game} /> // OK
```
