---
paths:
  - "**/*.{py,sh,toml,yaml,yml,ts,tsx,cjs,mjs,css,jsonc}"
  - "frontend/tsconfig.json"
---

# コードのコメント

- コメントを書く前に、その内容の置き場所を次の順に決める
  1. 名前・型・関数の分割・テストで表せる内容は、コードとテストで表す
  2. プロダクトの決まりとその意図は、`.claude/rules/documents.md` の「どの文書に何を書くか」が示す文書に書く
     - 該当する文書が無ければ作る
  3. 残った内容だけをコメントに書く

  ```
  OK: 1 に当たるので名前で表す
  shownStatuses: readonly ZukanProblemStatus[];
  NG:
  /** 今示す状態。 */
  statuses: readonly ZukanProblemStatus[];
  OK: 1 に当たり、名前が表している
  export type GameLevelCard = {
  NG:
  /** カードに示す、1つのレベルの台紙の進み具合。 */
  export type GameLevelCard = {
  ```

  ```
  OK: 2 に当たるので画面の文書に書く
  function ZukanLevelMosaicContent({ ... }) {
  NG:
  /** 台紙を開かなくても、そのレベルのどこをどの出来で解いてきたかの分布が、台紙と同じ位置に見える。 */
  function ZukanLevelMosaicContent({ ... }) {
  ```

  ```
  OK: 3 に当たる。その実装にしている理由
  // WebKitの採色は10px以下の面を除くので、通常の余白3単位（12px）を確保する。
  OK: 3 に当たる。別の自然な書き方にしていない理由
  // 台紙のマスへ Tab で入れるので、見えない囲みを Tab の止まり先にしない。
  OK: 3 に当たる。名前・型・テストで表せない前提
  // 新しい順なので、ここから先はカレンダーより前の日だけになる。
  OK: 3 に当たる。名前と型を読んでも全体像がつかめない手続きの要約
  // 候補が1つに決まるマスが無くなるまで、行・列・ブロックの制約を伝播させる。
  ```

- JSDoc と docstring も、export しているものを含めて、同じ順で決める
- コメントはその内容が当てはまる行のすぐ上に書く

  ```
  OK:
  <Tabs
    // 矢印キーで選ぶと通り過ぎたレベルの台紙を開いて変化を見せ終えるので、押したときと Enter・Space で選ぶ。
    activationMode="manual"
  >
  NG:
  /** 矢印キーで選ぶと通り過ぎたレベルの台紙を開いて変化を見せ終えるので、押したときと Enter・Space で選ぶ。 */
  export function GameLevelCards({ levels }: GameLevelCardsProps) {
  ```

- 理由にはコード・文書・計測で確かめた事実だけを書く

  ```
  OK:
  // 文字サイズのクラスは後ろに置くと cn が leading-none を外すため、先に置く。
  NG:
  // 数千のマスを要素にすると描画が重いはずなので、状態ごとに1つのパスで塗る。
  ```

- コメントには今のコードに当てはまることだけを書く

  ```
  OK:
  // 3段階の時代の記録を、旧区分のまま読み込み表示するためだけに残す。
  NG:
  // 以前は要素で描いていたが重かったのでパスに変えた
  // 後で難易度ごとに分ける
  ```
