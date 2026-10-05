# semantic lint 検出方式PoCの記録

> この文書は、semantic lint の検出方式を比較した PoC（2026-09-21〜24）の結果を残す開発メモであり、現在仕様の正本ではない。
> 現在の semantic lint の設計・使い方は `tools/semantic-lint/README.md` を正とする。

数値はすべて各PR本文・PRコメントに記録された実測値であり、この文書で新たに計測したものはない。推測を含む箇所は「推測」と明記する。

## 1. 背景

### 当時の方式の課題

当時の semantic lint は、Jev が意味判定する単位と、違反として表示する source range を同じ `Subject` に持たせていた（scope で決まる `vitest.test` など）。

そのため、広い文脈を必要とする判定と、細粒度の指摘位置を両立しにくかった。

- `arrange-outside-test` は test 全体や周辺コードを見ないと Arrange か判断できないが、指摘したいのは test 内の宣言文 `const values = [1, 2, 3];` だけ。
- 意味的な命名規約では、宣言全体を見つつ identifier（`const hoge = ...` の `hoge`）だけを指したい。
- 実際、当時の方式は Arrange warning を test 全体の range で出していた（#345 の同一ref比較で14件、いずれも `test(...)` 全体）。

内部では「意味判定に使うコード」「違反として指す source range」「人間向けに表示するコードフレーム」を分離したい、というのが出発点だった（#333 の設計メモ）。

### 目標としていた条件

#333 の設計メモで置いた条件:

- rule 作者は AST 分類や Jev への渡し方を意識せず、通常の rule 追加は YAML だけで完結する。
- rule 固有の TypeScript extractor を追加しない。
- Jev に行番号や source range を自由生成させず、range は parser 由来で確定させる。
- 広い意味判定と identifier 単位の指摘を同じ基盤で扱う。
- finding を距離だけで merge せず、pretty 表示の窓だけを coalesce する。
- 実 repository で運用可能な Jev 利用量・実行時間に収まる。

### 比較の目的

方式を完成させることではなく、「どの方式なら最小 rule API のまま diagnostic 品質と運用コストを両立できるか」を決めるため、共通の評価基盤・同一 fixture・同一指標で複数方式を比較した。

参考にした既存実装は `mizchi/jev-lint`（ast-grep で候補抽出、subject と report 位置の分離）、`JevGrep`（region と line を別判定、finding を表示上だけまとめる）、`Perch`（`where / each / sees / ensure` による範囲・単位・文脈の指定）、Semgrep / ast-grep / ESLint。

## 2. 方式ごとの概要と実測

### 共通の評価基盤（#334）

後続の PoC を同じ fixture・同じ指標で比べるための方式非依存の基盤。

- provider の確率・confidence を持たない canonical `Finding` を定義した。
- golden case に `expectedFindings`（fixture 内文字列 + occurrence、明示 range、指摘なしの空配列）を追加し、指摘位置の一致を評価できるようにした。
- eval レポートに指摘位置一致率と不一致 range を追加した。
- pretty 出力をコードフレーム中心へ変え、finding 自体は merge せず、表示窓が重なる場合だけフレームを共有するようにした。

以降の表の指標は次の意味で使う。

- exact: case 単位で期待 finding と完全一致した割合
- precision / recall: finding 単位
- requests / tokens: provider request 数と input / output token（複数 run の合計または平均。表ごとに明記）

### 2A: Candidate + Anchor（#335）

TypeScript AST から汎用 Candidate（variable declaration / expression statement / return / throw / function・method・class・property declaration）を抽出し、各 Candidate に `self / statement / name / initializer / body / expression` などの Anchor（parser 由来の range）を持たせる。全 Candidate を Jev で意味分類し、violation になった Candidate だけ Anchor を追加判定して指摘位置を選ぶ。

repository 静的計測（45 test file）:

| 指標 | 値 |
| --- | ---: |
| Candidate | 1,733 |
| Anchor | 4,572 |
| 当時の `vitest.test` subject | 225（Candidate はその約7.7倍） |
| 分類 request 見積 | 54 |
| 最大 Candidate / file | 184 |

代表7ケース × 3回の結果は後掲の比較表を参照。

観測:

- Anchor による位置特定は有望だった。Arrange 1件は3/3で宣言文全体、命名違反は全6実行で `hoge` identifier だけを指した。
- 失敗は Candidate の意味分類側に集中した（Arrange 3件の見逃し1回、test 外 Arrange の誤検知1回）。
- `table-driven-cases`（describe 全体が違反）は3/3で見逃した。

### 2B: selector 先行（#336）

rule 作者には selector を書かせず、内部の AST selector カタログから rule ごとに Jev が必要な selector を一度選び、一致した node だけを Candidate として分類する。selector 段階の取りこぼしを `selectorCoverage` として独立計測した。

- selector の選択は3回とも同一で揺れは少なかった。
- `table-driven-cases` では `vitest-describe` ではなく `vitest-test` を選び、selector 段階で3/3 hard false negative になった（selector coverage 21/24 = 87.5%）。
- Candidate 数は Arrange 1,215（2A 比約30%減に留まる）、命名 551、table-driven 225。
- 分類 decisions は 102 → 60 に減ったが、selector 推論（99 decisions）込みで request / token は2Aより増えた。

### 2C: Region + Anchor（#337）

内部で `file / describe / test / beforeEach` を region として抽出し、region ごとに「違反が存在するか」を判定、positive region だけ Anchor を直接判定する。Candidate の意味分類段階は持たない。

- 最初は file 全体を1 region として試したが、派生質問に元 rule の `violationThreshold: 0.90` を流用していたため region 違反確率 50〜70% の明確な Choice を落としていた。Choice の判定結果を使うよう修正し、さらに region 分割版に変えて最終比較した。
- repository 静的計測: region 367、LocationGroup 1,733、Anchor 4,572、region gate request / rule 45、全 file positive 時の total request / rule 139。
- region gate accuracy 16/21、region coverage 22/24 = 91.7%。
- Arrange 3件は3/3で期待3件に加えて Act を1件余計に検出した。region から Anchor へ直接飛ぶと「どの構文が違反か」の特定が抜け、precision が落ちた。
- table-driven は describe region の存在検出はできたが、describe 自体へ localize できたのは1/3。

### 2A / 2B / 2C の比較（代表7ケース × 3回の合計）

| 指標 | 2A Candidate + Anchor | 2B selector先行 | 2C Region + Anchor |
| --- | ---: | ---: | ---: |
| exact case | **16/21 = 76.2%** | 15/21 = 71.4% | 12/21 = 57.1% |
| finding precision | 20/21 = 95.2% | **17/17 = 100%** | 20/25 = 80.0% |
| finding recall | **20/24 = 83.3%** | 17/24 = 70.8% | **20/24 = 83.3%** |
| provider requests | **37** | 44 | 40 |
| input tokens | **106,216** | 137,038 | 168,597 |
| output tokens | **10,284** | 12,620 | 12,285 |

### 2A 精度改善（#345）

2A の方針（最小 rule API、rule 固有 selector や rule ID 分岐なし）を維持したまま、精度不足が構造上の限界か、rule 指示・共通契約・context・threshold の問題かを Phase ごとに切り分けた。

調整用7ケース × 10回（平均値は run あたり）:

| Phase | exact | 平均precision | 平均recall | 平均requests | 平均input tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| P0 baseline | 49/70 | 89.4% | 82.5% | 12.8 | 36,538 |
| P1 predicate 境界明確化 | 39/70 | 96.7% | 38.8% | 10.2 | 32,538 |
| P2 共通 Jev 契約 | 59/70 | 98.6% | 86.3% | 12.2 | 46,951 |
| P3 構造 context（`enclosingCalls`） | 64/70 | 98.8% | 92.5% | 12.5 | 50,662 |
| P4 threshold 校正（Arrange のみ 0.90→0.85） | **70/70** | **100%** | **100%** | 13.0 | 52,278 |

一方、調整に使っていない実コード由来の holdout 9ケース × 10回では exact 67/90 = 74.4%、precision 100%、recall 54.0% に落ちた（GamePictogram 初期 render 0/10、Nanpure 入力値 4/10 など）。

実 repository 45 test file への適用:

- Arrange: Choice 分布 violation 88 / compliant 1,184 / not_applicable 461、threshold 後 finding 2件、input tokens 1,535,403
- table-driven: Choice 分布 violation 3 / compliant 50 / not_applicable 1,680、finding 0件、input tokens 1,519,010
- 既知の holdout positive が実 repository にあるため、0〜2件は見逃しを含む。
- `frontend/src/games/water-sort/score.test.ts` の table-driven 候補は holdout では violation 確率約90% だったが、file 全体を含む実 repository 実行では `compliant / violation 24%` まで低下した。

few-shot 追加実験（PR コメント）:

| 指標 | zero-shot P4 | few-shot |
| --- | ---: | ---: |
| 調整用 exact | 70/70 | 68/70 |
| holdout exact | 67/90 | 74/90 |
| holdout precision / recall | 100% / 54% | 100% / 68% |
| holdout 平均input tokens | 67,282 | 92,306 |

実 repository では few-shot を各 Candidate question に繰り返す構造のため、batch 64 で最初の request が `max_tokens_exceeded` になった。batch 16 では完走し、Arrange finding は zero-shot 1件 → few-shot 108件（input tokens 1,725,199 → 2,712,540）。実 repository finding には正解ラベルがないため、finding 数の増加は精度改善とは扱っていない。

### 2D: compact structural state（#348）

2A の Candidate / Anchor / rule / threshold を固定したまま、Jev へ渡す state を whole file から compact structural state（AST node kind、callee、enclosing call と test / describe label、identifier・initializer の capture など）へ置き換えた。

| 構成 | 調整用 exact | holdout exact | holdout precision | holdout recall | holdout 平均input tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2A zero-shot | 70/70 | 67/90 | **100%** | 54% | 67,282 |
| 2D zero-shot | 69/70 | **77/90** | 84.5% | **74%** | 79,152 |
| 2A few-shot | 68/70 | 74/90 | **100%** | 68% | 92,306 |
| 2D few-shot | **70/70** | 76/90 | 87% | 72% | 101,281 |

実 repository（zero-shot、batch 64）: Arrange finding 8件 / requests 59 / input tokens 1,689,387、table-driven finding 0件 / requests 54 / input tokens 1,654,881。

- holdout recall は改善したが false positive が出て precision が下がった。
- full file を除いても token は減らず増えた。full file は batch ごとに1回だが、構造 metadata は subject ごとに増えるため。
- table-driven は依然0件で、単一 describe Candidate の粒度問題は state の圧縮では解消しなかった。
- few-shot は compact state でも batch 64 で `max_tokens_exceeded` になり、token のボトルネックは full file だけでなく「各 Candidate question へ長い rule / few-shot 指示を繰り返す batch 構造」にもあると分かった。

### 2E: relation group（#353）

同一 container 直下で構造が揃う兄弟 statement 群を group Candidate として汎用抽出し、relation metadata（relation kind、member kinds、enclosing calls、member labels、共有構造シグネチャ、member ごとの literal 値）を付けて1つの判定対象にした。

Phase 1（既存 atomic Candidate へ relation Candidate を単純追加、rule / threshold 固定）:

| dataset | 2A | 2E relation 混在 |
| --- | ---: | ---: |
| 調整用 exact | 70/70 | 60/70 |
| 調整用 precision / recall | 100% / 100% | 80% / 90% |
| holdout exact | 67/90 | 56/90 |
| holdout precision / recall | 100% / 54% | 94.1% / 32% |

実 repository では Candidate 1,794 / Anchor 4,752、table-driven finding は0件だったが、`water-sort/score.test.ts` の relation Candidate 自体は violation 58〜59% で上位に出ていた。意味の異なる Candidate family を同じ predicate / threshold で扱うこと自体が問題だった。

Phase 2（relation だけを評価）: zero-shot では positive（violation 73〜92%）と「構造は同じだが別の業務規則」の negative（76〜88%）を threshold で分離できなかった。few-shot で意味境界を与えると positive 76〜88%、negative 49〜65% まで分離した。

Phase 3（production 共通 prompt を変えず PoC 内で relation 用 predicate・few-shot・threshold 0.70 を校正）: 6ケース × 10回で exact 60/60、precision 100%、recall 100%、input tokens 28,631 / run。ただし6ケースの focused corpus であり、repository 全体の precision を保証するものではない。

結論として、relation を atomic とは別 target として扱えば判定できるが、「rule がどの target family を判定するかをどう宣言するか」が残った。

### 2F: target family（PR なしの実験ブランチ）

PR にはしていない。以下は #353 ブランチ上のコミット `157d8ce`、実験ブランチのコミットメッセージ・workflow 定義・benchmark YAML から分かる範囲で、各 run の数値はこの文書では拾っていない。

- PoC の benchmark だけに `targetFamily` を持たせ、rule ごとに parser が作る判定単位を切り替えた（production rule API ではない）。family は次の3種類。
  - `callback-statement`: callback 直下の各 statement を個別 target にする（Arrange など、1 callback 内で複数 finding が要る rule 向け）。
  - `callback-call`: callback を持つ call 全体を target にする（beforeEach や DOM test など）。
  - `relation-group`: 同一 container 直下の構造が揃う兄弟 statement 群を target にする（table-driven）。
- 対象を Vitest の4 rule（`arrange-outside-test` / `before-each-arrange-only` / `dom-observable-contract` / `table-driven-cases`）へ広げ、期待位置を候補 Anchor として生成できた割合を `targetCoverage` として出し、family 生成の取りこぼしと Jev 側の失敗を分けて評価した。
- `experiment/semantic-lint-target-family-vitest-20260923`: 上記を golden benchmark 10回と実 repository へ適用する workflow。
- `experiment/semantic-lint-target-family-vitest-20260924`: 次を順に試した。
  - Arrange の実 repository 候補の全件監査
  - callback target へ test 名・位置などの判定文脈を追加
  - 実 repository のファイルを fixture とする golden（Arrange: `nanpure/play-record.test.ts`、`nanpure/problem/generation/solver.test.ts`、`nanpure/puzzle/rules.test.ts`、`water-sort/puzzle/rules.test.ts` など。table-driven: `water-sort/score.test.ts` の3反復と、構造は同じだが別業務規則の negative）
  - target context mode / state mode（target-only、subjects-only）と batch size を比較可能にし、target 文脈と batch 干渉を比較
  - callback body を局所 region として target に持たせ、region を request 内で共有
  - callback region 単位で batch を分割し、region batch での false negative 確率を監査

（推測）コミットの流れからは、自作 fixture から実 repository golden へ評価の軸足を移し、判定単位よりも「target にどの範囲の文脈を持たせ、どう batch に束ねるか」が精度に効くかを調べていたと読める。

## 3. 分かったこと

- **自作 fixture だけの評価は当てにならない。** 2A は調整用7ケースで 70/70 に達したが、未使用 holdout では recall 54%、実 repository では既知 positive を多数見逃した。調整セットの点数ではなく、実 repository のコードに正解を付けた golden で測る必要がある。
- **全構文を候補にすると爆発する。** 汎用 Candidate は当時の subject の約7.7倍（1,733件）になり、実 repository 全件分類は rule あたり約150万 input tokens かかった。selector で絞っても Arrange のような広い rule では約30%減に留まった。
- **候補を Jev に選ばせる段階は回復不能な取りこぼしを生む。** 2B の selector 誤選択は後段で救えない hard false negative になった。判定単位はモデルではなく静的に決めるほうが安全。
- **閾値を全対象で共通固定すると精度が落ちる。** 2C の派生質問への `0.90` 流用、P1 で positive が threshold 未満へ落ちた件、2E で relation に別 threshold（0.70）が要った件のように、対象の種類ごとに確率分布が違う。
- **関係（兄弟 test の組）は単一 node の候補では扱えない。** table-driven は 2A〜2D のいずれでも実 repository で0件だった。relation を独立した target として持ち、専用の判定基準で問う必要があった。
- **意味判定と指摘位置の分離自体は成立する。** parser 由来の Anchor から位置を選ぶ部分は一貫して安定しており、失敗は主に「どこが違反か」の意味分類側に出た。
- **文脈量と batch 構成で判定が変わる。** 同じ候補が単体では violation 約90%、file 全体を含む batch では 24% まで下がった。compact state は token を減らさず、few-shot の繰り返しで `max_tokens_exceeded` が起きた。文脈の渡し方と batch の束ね方は、判定単位とは別の設計問題として扱う必要がある。
- **few-shot の効果は一様ではない。** holdout recall は上がったが、既知ケースの一部で退行し token も増えた。

## 4. その後どうなったか

最終的には、tree-sitter の unit カタログ（file / function / test / test-group / component / hook / variable / test-title / comment など）で unit を静的に決め、Jev は「違反 / 違反ではない / 判断できない」の3択で判定し、指摘位置もカタログの宣言で静的に決める形へ移行した（ブランチ `claude/semantic-lint-architecture` / `claude/semantic-lint-rule-migration`、PR #360）。詳細は `tools/semantic-lint/README.md` を参照。

## 5. リンク

### PR

- #333 設計PoCメモ: https://github.com/hizahizi-hizumi/pa-zzle/pull/333
- #334 finding 評価基盤: https://github.com/hizahizi-hizumi/pa-zzle/pull/334
- #335 2A Candidate + Anchor: https://github.com/hizahizi-hizumi/pa-zzle/pull/335
- #336 2B selector 先行: https://github.com/hizahizi-hizumi/pa-zzle/pull/336
- #337 2C Region + Anchor: https://github.com/hizahizi-hizumi/pa-zzle/pull/337
- #345 2A 精度改善: https://github.com/hizahizi-hizumi/pa-zzle/pull/345
- #348 2D compact structural state: https://github.com/hizahizi-hizumi/pa-zzle/pull/348
- #353 2E relation group: https://github.com/hizahizi-hizumi/pa-zzle/pull/353
- #360 最終方式: https://github.com/hizahizi-hizumi/pa-zzle/pull/360

### ブランチ

- PR ブランチ: `feat/semantic-lint-candidate-anchor-20260921`（#333）、`feat/semantic-lint-finding-eval-20260922`（#334）、`poc/semantic-lint-candidate-anchor-20260922`（#335）、`poc/semantic-lint-selector-first-20260922`（#336）、`poc/semantic-lint-region-anchor-20260922`（#337）、`poc/semantic-lint-accuracy-20260922`（#345）、`poc/semantic-lint-compact-state-20260922`（#348）、`poc/semantic-lint-relation-group-20260922`（#353）
- 2F 実験: https://github.com/hizahizi-hizumi/pa-zzle/tree/experiment/semantic-lint-target-family-vitest-20260923 、 https://github.com/hizahizi-hizumi/pa-zzle/tree/experiment/semantic-lint-target-family-vitest-20260924
- その他、各 PR の実測用に `experiment/semantic-lint-*-2026092x` ブランチが残っている。

### 主要な Actions run

| 内容 | run |
| --- | --- |
| 2A benchmark ×3 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35674535456 |
| 2B benchmark ×3 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35676408466 |
| 2C file 単位版（修正版） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35684980908 |
| 2C region 分割版 ×3 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35685290779 |
| 2A 精度改善 P0 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35687979680 |
| 2A 精度改善 P1 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35688166702 |
| 2A 精度改善 P2 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35688289082 |
| 2A 精度改善 P3 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35690313295 |
| 2A 精度改善 P4 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35690463701 |
| 2A holdout（P5） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35690950896 |
| 2A 実 repository（P6） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35694436427 |
| 2A Candidate 分布（P6b） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35694724340 |
| 当時の方式との比較 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35695660032 |
| 2A few-shot benchmark | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35698536534 |
| 2A few-shot 実 repository（batch 64、`max_tokens_exceeded`） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35698684845 |
| 2A zero/few-shot 実 repository（batch 16） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35698979487 |
| 2D benchmark + 実 repository | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35702199525 |
| 2D 実 repository batch 16 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35702535417 |
| 2E Phase 1 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35785139452 |
| 2E Phase 3 最終 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35794165342 |
| 2F Vitest 全体（0923） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35798032741 |
| 2F Vitest 全体（0924） | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35951058585 |
| 2F 実 repository golden | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35953192216 |
| 2F region batch の FN 確率監査 | https://github.com/hizahizi-hizumi/pa-zzle/actions/runs/35962944257 |
