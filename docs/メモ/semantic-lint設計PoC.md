# semantic lint 設計PoC

この文書は semantic lint の次期設計を検討するための作業メモです。現在仕様の正本ではなく、実装・計測で成立性を確かめながら更新します。

現時点では `Candidate + Anchor` 方式が有力ですが、候補数・Jevの判定精度・指摘位置の精度に懸念があります。PoCで期待どおりに成立しなければ、この方式に固執せず別案も試します。

## 背景

現在のsemantic lintは、Jevが意味判定する単位と違反として表示するsource rangeを同じ `Subject` に持たせています。

`arrange-outside-test` ではtest全体や周辺コードを見ないとArrangeか判断できませんが、指摘したいのは次の宣言です。

```ts
const values = [1, 2, 3];
^^^^^^^^^^^^^^^^^^^^^^^^^^
```

意味的な命名規約なら、宣言全体を見つつidentifierだけを指したいケースもあります。

```ts
const hoge = getUser();
      ^^^^
```

そのため内部では次を分離します。

- 意味判定に使うコード
- 違反として指すsource range
- 人間向けに表示するコードフレーム

## 目標

- rule作者はASTの分類やJevへの渡し方を意識しない。
- 通常のrule追加はYAMLだけで完結させる。
- rule固有のTypeScript extractorを追加しない。
- Jevに行番号やsource rangeを自由生成させない。
- 広い意味判定とidentifier単位の指摘を同じ基盤で扱う。
- findingの意味とpretty表示上のまとめ方を分離する。
- 精度やコストが悪ければ、外部rule形式を保ったまま内部方式を差し替えられるようにする。

## rule作者から見える形

まずはrule設定を小さく保ちます。

```yaml
paths:
  - frontend/**/*.test.ts
  - frontend/**/*.test.tsx
  - frontend/**/*.test.mjs

defaults:
  severity: warning
  violationThreshold: 0.90

rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    predicate:
      instruction: |
        判定対象のコードがArrangeであり、
        test本体ではなく事前準備へ移すべきか判定する。
      outcomes:
        violation: |
          テストデータ生成、状態構築、mock・spy構築、
          初期renderなどのArrangeである。
        compliant: |
          Act、Assert、またはtest内に置くことが適切な処理である。
        not_applicable: |
          このルールの対象ではない。
        insufficient_context: |
          周辺コードを見てもArrangeかどうか判断できない。
```

`scope`、`target`、`context`、`statement` のような内部都合は、必要性が実測されるまでは通常のrule APIへ出しません。

4つのoutcome名は自由なラベルではなく、semantic lint側で意味を持つ予約語として扱う想定です。

## 現在の有力案: Candidate + Anchor

### Candidate

Candidateは、Jevへ「このコード自体がruleに違反するか」を問い合わせる単位です。TypeScript adapterがASTから汎用的に生成し、ruleごとの抽出処理は持ちません。

### Anchor

AnchorはCandidate内部でdiagnostic位置として利用できるsource rangeです。parserから得た確定的なrangeを使います。

```ts
const hoge = getUser();
```

なら概念的には次です。

```text
Candidate: VariableDeclaration
  self        -> const hoge = getUser()
  name        -> hoge
  initializer -> getUser()
```

Arrange規約なら `self`、命名規約なら `name` が自然です。この違いをrule YAMLへ書かせず、violationになったCandidateだけ位置特定する案を試します。

## 想定パイプライン

```text
paths
  ↓
Language Adapterでparse
  ↓
Candidate + Anchorの索引
  ↓
rule × CandidateをJevで意味判定
  ↓
violationThresholdを超えたCandidate
  ↓
Anchorから指摘位置を選択
  ↓
canonical Finding
  ↓
pretty / compact / json
```

意味判定は `violation / compliant / not_applicable / insufficient_context` の4択です。親Candidateの中に子の違反が存在するだけで親自身を違反にしないよう、「Candidate自身を分類する」という共通制約を持たせます。

contextは局所から開始して `insufficient_context` のときだけ親構造、最終的にfile全体へ広げる案をまず試します。再問い合わせのコストや揺れが大きければ、最初からfile全体を渡す方式とも比較します。

指摘位置はviolationになったCandidateだけ既知のAnchorから選びます。「その箇所を直接変更することで違反を解消できる、最も正確な構文範囲」を基準とし、単に狭いrangeを優先しません。位置選択が不確かな場合はCandidate全体へフォールバックします。

## Findingと表示

findingは表示都合でmergeしません。

```ts
const badName = foo();
doSomething();
const otherBadName = bar();
```

2つの命名違反なら、内部的には最後まで2 findingです。

pretty出力では、それぞれの前後contextを含む表示窓が重なる場合だけ同じコードフレームを共有します。

```text
semantic/no-bad-name  2 findings

1 │ const badName = foo();
  │       ^^^^^^^
2 │ doSomething();
3 │ const otherBadName = bar();
  │       ^^^^^^^^^^^^
```

`doSomething()` はcontextとして表示されるだけです。つまり「近接違反をmergeする」のではなく、**独立findingの表示窓だけをcoalesceする**ものとして扱います。compact / JSONではfindingを別々に出します。

## PoCで見えている懸念

### Candidate数

現時点の試作では49テストファイルから2,111 Candidateが生成されました。

- 平均: 約43 Candidate / file
- 最大: 189 Candidate / file

最初は `PropertyAssignment` や `Parameter` まで独立Candidateにしてさらに膨らんだため、細粒度構造はCandidateではなくAnchor/contextへ寄せています。実際のJev利用量・レイテンシ・batch上限を測って許容可能か確認します。

### Candidate抽出

狭くしすぎると対象コードがJevへ届きません。広くしすぎると質問数と親子重複が増えます。現状は取りこぼしよりover-matchを許容する方向ですが、最適点は未確定です。

### Anchor選択

意味判定が正しくても、Anchor選択が誤ればlint UXは悪くなります。宣言全体、identifier、argument/property、複数related locationを代表ケースにして確認します。

### 親子Candidateの重複

親と子の両方がviolationになる可能性があります。単純に子を優先せず、位置特定後に同じprimary rangeへ着地したfindingだけdedupeする案などを試します。

## 参考にしている既存実装

- `mizchi/jev-lint`: https://github.com/mizchi/jev-lint
  - ast-grepで候補を抽出してJevへ意味判定させる。
  - 判定に見せるsubject/contextとreport位置を分離している。
  - 今回は同等のAST知識をrule作者へ要求せず内部化できるか試す。
- `JevGrep`: https://github.com/thehumanworks/jevgrep
  - regionとlineを別々に判定する。
  - findingをmergeせず表示上だけまとめる考え方を参考にする。
- `Perch`: https://github.com/lakeday-org/perch
  - `where / each / sees / ensure` で探索範囲・判定単位・文脈を指定する。
  - 必要な能力の整理には参考になるが、同等の指定をrule作者に要求しない方向を先に試す。
- Semgrep / ast-grep / ESLint
  - 広い構造を判定に使いつつ、最終diagnosticをidentifierやtokenなど別の細粒度位置へ置く設計を参考にする。

## 他に試す候補

`Candidate + Anchor` は最終方式として固定しません。

### selector先行方式

`jev-lint` に近く、AST/ast-grepで候補をかなり絞ってからJevへ渡します。semantic lint側がrule内容からselectorを自動選択できるなら候補数を減らせますが、selectorを誤ると対象がJevへ届かない点が弱みです。

### 階層的探紺

file / function / testなど粗いregionで「この中に違反があるか」を判定し、positiveなbranchだけ子へ掘ります。質問数を減らせる可能性はありますが、上位階層のfalse negativeで配下を丸ごと見逃すリスクがあります。

### file単位判定 + Anchor ID

file全体をJevへ見せ、違反箇所を既知のnode/anchor IDから選ばせます。質問数は減らせますが、一度に複数違反を漏れなく列挙できるか、Jevに適した問題設定になるかを確認する必要があります。

自由な行番号やコード文字列を生成させ、それを再検索する方式は位置が不安定になるため原則採用しません。

## 次に試すこと

1. `arrange-outside-test` だけを新経路へ載せる。
2. `const values = ...` 全体を正しく指せるか確認する。
3. テスト用の命名ruleで `const hoge = ...` の `hoge` だけを指せるか確認する。
4. 親子Candidateの重複を確認する。
5. Candidate数、Jev request数、利用量、レイテンシを測る。
6. 重すぎる場合、selector先行方式と階層探索を同じfixtureで比較する。
7. `table-driven-cases` でcontext自動拡張を試す。
8. prettyではfindingをmergeせず、表示窓だけをcoalesceできることを決定論的テストで確認する。

## 採用判断の目安

- 通常のrule YAMLにAST種類やcontext指定を書かなくてよい。
- `arrange-outside-test` で意味判定と指摘位置が自然になる。
- identifierなど細粒度rangeを正確に指せる。
- source rangeはparser由来で確定する。
- finding同士を距離だけでmergeしない。
- 新ruleごとのTypeScript extractorを要求しない。
- 実repositoryで運用可能なJev利用量・実行時間に収まる。
- 既存rule移行時に、旧方式より見逃しや誤検知が明確に悪化しない。

この基準を満たせない場合、現在の内部設計を守ること自体は目的にしません。rule作者の体験とdiagnostic品質を保てるなら、PoC結果に応じて内部方式を入れ替えます。
