# Semantic lint

プロジェクト固有の意味的規約をbounded decision providerで検査する独立ツール。

人間向け規約の正本は `.claude/rules/*.md`、実行可能なsemantic ruleはリポジトリルートの `.semantic-lint/` に置く。semantic lint自体はGit diffやPRに依存せず、repository / directory / fileを入力として動く。

## Setup

```sh
bun install --cwd tools/semantic-lint --frozen-lockfile
```

providerを使うコマンドでは `TYPESAFE_API_KEY` が必要。CLIはrepository rootの `.env` を自動で読み込むため、通常はtool directoryへ `.env` を置かない。

既にprocess environmentへ設定されている値はそのまま利用できる。

## Commands

```sh
# 全ruleを実行
bun run --cwd tools/semantic-lint check

# directory / fileを限定
bun run --cwd tools/semantic-lint check -- frontend/src/games/nanpure

# 判定cacheを使わずにproviderへ送り直す
bun run --cwd tools/semantic-lint check -- --no-cache

# providerを呼ばず、request数と推定input tokenを確認 (API key不要)
bun run --cwd tools/semantic-lint check -- --plan-only

# rule一覧
bun run --cwd tools/semantic-lint rules

# providerを呼ばず、rule / unit / request payloadを確認
bun run --cwd tools/semantic-lint inspect -- \
  vitest/arrange-outside-test \
  frontend/src/records/storage.test.ts \
  --plan-only

# provider responseまで含めて調査
bun run --cwd tools/semantic-lint inspect -- \
  vitest/arrange-outside-test \
  frontend/src/records/storage.test.ts

# golden corpusで校正
bun run --cwd tools/semantic-lint eval -- vitest/arrange-outside-test --repeat 10

# 実repo goldenで現行方式を採点 (providerを呼ぶ)
bun run --cwd tools/semantic-lint bench -- vitest/arrange-outside-test --repeat 3

# benchのrequest数と推定input tokenだけを確認 (providerを呼ばない)
bun run --cwd tools/semantic-lint bench -- --plan-only

# 既存のRunResult JSONをgoldenで採点 (providerを呼ばない)
bun run --cwd tools/semantic-lint bench -- --score <run-result.json>

# 設定・golden・unitカタログの整合性確認
bun run --cwd tools/semantic-lint doctor

# tool自身の決定論的検証
bun run --cwd tools/semantic-lint typecheck
bun run --cwd tools/semantic-lint test
```

CLIのpath引数はrepository root基準で解決する。

## 仕組み

ruleは対象path（`paths`。rulesetの `exclude` に一致するpathを除く）と判定対象の単位（`unit`）を宣言する。unitカタログがsourceから判定対象の `Subject` を決定論的に抽出し、providerはそのsubjectがruleの `instruction` に違反するかだけを判定する。行範囲やsymbolはmodelに生成させない。

provider結果へruleのthresholdを1回だけ適用し、canonicalな `Diagnostic` を作る。pretty / compact / JSON出力はこのDiagnosticから生成する。

### 判定の質問

unitの判定は、次の3択のchoiceで問う。選択肢の説明は全ruleで共通の固定文（`providers/typesafe/provider.ts` の `DECISION_CRITERIA`）で、ruleごとの判定基準は質問文に載せるruleの `instruction` だけが持つ。選択肢は質問ごとに送るため、説明文を短く保ち、質問あたりのtokenを抑える。

| 選択肢 | 説明文 | 扱い |
| --- | --- | --- |
| `violation` | The subject violates the rule. | この確率をthresholdと比べ、以上なら指摘する |
| `no_violation` | The subject does not violate the rule. | 指摘しない。ruleが当てはまらないsubjectも含む |
| `cannot_judge` | The given code is not enough to judge. | 指摘せず、unknownとして実行サマリに数える |

質問文は「`state.subjects.sN` だけをruleで判定し、`state.file` の残りは文脈とする」という1文と、`Rule:` に続くruleの `instruction` からなる。

### 違反箇所の特定

指摘範囲はunit全体ではなく、unitの中で違反している箇所にする（例えばtest本体のArrangeなら `const values = [1, 2, 3];` の文）。rule作者は何も書かない。

カタログがunitの指摘位置（`report`）を宣言しているunit（`variable` / `test-title`）は、位置を構文で静的に決める（「指摘位置を宣言したunit」を参照）。それ以外のunitは次の2段で判定する。

1. unitを違反と判定する（「判定の質問」の3択のchoice。violationの確率をruleの `violationThreshold` と比べる）。
2. 違反と判定したunitの中の候補（part）ごとに、そこが違反箇所かを判定する（yes / noの確率を返すnoul）。

partは構文だけで決める。unit直下の文（カタログの `statement` queryで抽出した文のうち、unitとの間に別の文を挟まないもの）と、unit直下の子unit（describeの中のtestやbeforeEachなど）で、子unitを含む文はその子unitに置き換える。ruleやrule IDで分岐せず、行番号もmodelに生成させない。

2段目は、1段目で違反と判定したunit（`check` ではthreshold以上のもの）だけを、fileごとの別requestで問う。stateにはそのunitと祖先・文脈のunitだけを載せ、partを `/* pN */` と `/* /pN */` の目印で囲む。partの質問が参照するruleの `instruction` は `state.rules` に1回だけ載せる。partの質問を1段目へ投機的に全unit分入れる方式は、golden対象では2段に分けるのとほぼ同じtoken数だが、違反の少ない通常のrepository全体では1段目だけの約1.5倍になるため採らない。

違反と判定したunitでは、確率が0.25以上（`diagnostics/locate.ts` の `PART_VIOLATION_THRESHOLD`。golden benchmarkで全rule共通に校正した値で、ruleには書かない）のpartを指摘する。

- 文は1つずつ別の指摘にする。
- 連続して選ばれた子unitは1つの範囲に結合する（同じ期待動作を繰り返す兄弟testの組など、兄弟の関係そのものが違反になる規約のため）。
- どのpartも選ばれない、またはpartがないunitはunit全体を指摘する（unit自体が違反の場合）。

Diagnosticの `range` は違反箇所、`subjectRange` / `symbol` は違反と判定したunit、`probability` はunitの違反確率、`partProbability` は選んだpartの確率。

### 指摘位置を宣言したunit

文より細かい位置（変数名・テスト名の文字列など）への指摘は、modelに位置を選ばせず、カタログのデータで決める。`units.yaml` のunitに `report: <capture名>` を書き、各言語のqueryにそのcaptureを持たせる。

```yaml
# catalog/units.yaml
variable:
  level: syntax
  description: 変数宣言（名前が1つの識別子の宣言子ごと。初期値を含む）
  report: name

# catalog/syntax/typescript.yaml
variable:
  symbol: "{name}"
  query: |
    (variable_declarator name: (identifier) @name) @unit
```

- 判定は `@unit` の範囲（変数なら初期値を含む宣言）で1段だけ行い、違反なら `@name` の範囲を指摘する。Diagnosticの `range` はその範囲（列を含む）、`subjectRange` は判定したunit。
- 2段目の違反箇所は問わず、partを持たない。他のunitのpartや子unitにもならないため、`variable` を判定するruleを追加しても、同じfileの `test` などのpartは変わらない。
- 囲むコードの一部として扱い、判定対象でないときは目印を付けずに本文を残す（`/* omitted */` にしない）。そのため、testだけを判定するrequestのstateとcache keyは、`variable` / `test-title` のunitがあってもなくても同じ。
- `report` のcaptureを持たないqueryはカタログの読み込みエラーになる。

### unit語彙

ruleの `unit` には意味の名前を書く。どの構文を抽出するかは、ファイルの拡張子から決まる言語とカタログの定義で決まる。

| unit | 種類 | 抽出するもの |
| --- | --- | --- |
| `file` | file | ファイル全体。構文解析しないため全言語で使える |
| `function` | 汎用 | 関数宣言・関数式・arrow function・method |
| `statement` | 汎用 | ブロック直下の文（入れ子の文もそれぞれ1 unit） |
| `variable` | 汎用・指摘位置あり | 変数宣言子（`const` / `let` / `var`。for文の初期化を含む）。名前が1つの識別子のものだけで、分割代入は含めない。指摘位置は宣言した名前。文脈は同じscope以下の `test` / `test-group` / `setup` / `teardown` / `function` / `component` / `hook` |
| `test` | 名前付き | Vitestの `test` / `it` 呼び出し（`test.each(...)(...)`、`it.skip` などを含む）。第1引数が文字列リテラルのもの |
| `test-title` | 名前付き・指摘位置あり | `test` のケース名の文字列（第1引数）。unitと指摘位置は同じ範囲。`describe` の名前は含まない |
| `test-group` | 名前付き | Vitestの `describe` 呼び出し（`describe.each` を含む） |
| `setup` | 名前付き | Vitestの `beforeEach` / `beforeAll` 呼び出し |
| `teardown` | 名前付き | Vitestの `afterEach` / `afterAll` 呼び出し |
| `component` | 名前付き | Reactの関数コンポーネント（大文字で始まりJSXを含む関数。`memo` / `forwardRef` を含む）。TSX / JSXのみ |
| `hook` | 名前付き | Reactのカスタムフック（`use` + 大文字・数字で始まる関数） |

対応言語はTypeScript（`.ts` / `.mts` / `.cts`）、TSX（`.tsx`）、JavaScript（`.js` / `.mjs` / `.cjs` / `.jsx`）。

### unitカタログ

カタログは `tools/semantic-lint/catalog/` のデータで、rule作者は編集しない。構文解析はweb-tree-sitterとnpmのwasm文法（`tree-sitter-typescript` / `tree-sitter-javascript`）で行い、native buildに依存しない。

- `units.yaml`: 語彙。unit名、level（`file` / `syntax` / `framework`）、判定時の文脈（`context`）、指摘位置（`report`）。
- `languages.yaml`: 言語ごとの拡張子、wasm文法、scopeになる構文node、unit本文を置き換える目印。
- `syntax/*.yaml`: 汎用unitの言語ごとのtree-sitter query。
- `frameworks/*.yaml`: 名前付きunitの「言語 × フレームワーク」のtree-sitter query。`@unit` captureがunitの範囲、`symbol` の `{capture}` が表示名になる（文字列リテラルは値をJSON文字列にする）。`contains` で子孫に特定nodeを含むものだけに絞れる。

フレームワークへの対応や言語の追加は、TypeScript実装を変えずにこれらのデータを追加して行う。同じ言語で同じunitを複数のフレームワークが定義するとカタログの読み込みエラーになる。`doctor` は全文法の読み込みと全queryのcompileを行い、ruleの対象fileのうち言語にunit定義がないものを警告する。

unitの文脈はカタログの `context` で宣言する。判定時は常に、unit本文・囲むunit（祖先）・どのunitにも含まれないファイルの骨格（importや補助関数など）を文脈にする。加えて `test` は、自分を含むscopeにある `setup`（同じ/外側の `describe` の `beforeEach` など）を、`setup` と `teardown` は自分のscope内の `test` を文脈にする。ruleが判定しない種類のunit（例えば `teardown` を使うruleがないときの `afterEach`）は抽出せず、ファイルの骨格としてそのまま文脈に残る。

### request

1ファイルに当たる全rule × 全unitを、token予算（`.semantic-lint/config.yaml` の `execution.requestTokenBudget`。既定はstate + 最長の質問1つで32,000、request全体で64,000）に収まる限り1 requestにまとめ、stateとrequest固定費をファイルあたり1回にする。予算を超える見積もりのときだけ、unitの出現順に分割する。見積もりはJevの課金係数（request固定約316、choiceの質問1つ約8、noulの質問1つ約23、選択肢1つ約25、質問文と選択肢の英単語1語約1.13、stateはJSONのASCII文字約4文字/token・非ASCII文字1文字約1.86 token）による近似。golden benchmarkの実usageに対し、requestごとに±5%程度、合計で±1%程度に収まる（`bench` の `usage` で確認できる）。

stateは次の形で、ファイルは元の並びのまま1回だけ載せ、各文字は `state.file.source` に1回だけ現れる。

```json
{
  "file": {
    "path": "...",
    "source": "import ...\n\n/* state.subjects.s0 begin */describe(\"...\", () => {\n  /* state.subjects.s1 begin */test(\"...\", () => { ... })/* state.subjects.s1 end */;\n})/* state.subjects.s0 end */;\n"
  },
  "subjects": {
    "s0": { "unit": "test-group", "symbol": "describe(\"...\")" },
    "s1": { "unit": "test", "symbol": "test(\"...\")" }
  }
}
```

判定対象のunitは開始・終了の目印（`/* state.subjects.sN begin */` / `/* state.subjects.sN end */`）で囲み、質問はその範囲だけを判定させる。partの目印と `state.rules` は「違反箇所の特定」を参照。入れ子のunitも親の本文の中にそのまま現れるため、describeを判定するときに中のtestを参照先から辿る必要がない。requestには判定対象とその子孫・祖先、文脈のunitまでを載せ、それ以外のunit（cache hitしたunitや分割した別requestのunit）は `/* omitted */` にする。

## 判定cache

`check` と `inspect` は、providerの判定結果をrepository rootの `.semantic-lint/.cache/decisions.jsonl` に保存し、providerへ送る内容が同じ判定を再利用する。`.semantic-lint/.cache/` はGit管理しない。

保存するのはthreshold適用前のprovider判定（Choiceと3択それぞれの確率、confidence、応答したprovider / model）と、2段目で問うたpartごとの確率。partの確率は判定と同じentryへ足して保存するため、thresholdを下げて新たに違反になったunitは2段目だけを問う。thresholdは実行ごとにcacheから読んだ判定へ適用するため、thresholdやseverityを変えても再判定しない。

cache keyはrule × unit単位で、1判定の答えを決める次の要素のSHA-256とする。

- provider種別、設定上のmodel、provider側のprompt / request組み立ての版（TypeSafeでは `TYPESAFE_REQUEST_FORMAT`）
- ruleのunitと `instruction` の文面
- fileのpathと、unitの文脈: unit本文・祖先・カタログのcontext宣言が指すunit・ファイルの骨格を元の位置に並べ、それ以外のunitを共通の目印に置き換えたもの
- unitの中のpartの位置（partの確率の並びを決めるため）

threshold、severity、rule id、title、行番号はkeyに含めない。

同じファイルの別unitの本文だけを変えた場合、変えたunitだけがmissする。指摘位置を宣言したunit（`variable` / `test-title`）は骨格の一部なので、変数宣言を変えると同じfileの `variable` の判定と、その宣言を含むunit・骨格に依存するunitがmissする。文脈に宣言したunit（testから見たsetupなど）や骨格（importや補助関数）を変えた場合は、それに依存するunitがmissする。unitの追加・削除や、そのファイルに適用するunitの種類の変更は骨格を変えるため、そのファイルの判定がmissする。

providerへの送信はfileごとのbatchだが、hit / missはtaskごとに判定し、missしたtaskだけでbatchを組み立てる。

新しい判定はprovider応答ごとに追記するため、途中で失敗した実行で得た判定も次回に使える。実行完了時にcacheを書き直し、重複を畳んで、最終利用から30日を過ぎたentryと50,000件を超えた古いentryを削除する。読めない行や形式の合わないentryは無視してmissとして扱い、次の書き直しで削除する。

- `--no-cache`: cacheを読まず、書きもしない。
- golden caseで判定の揺れを測る `eval` はcacheを使わない。
- `check --plan-only` はcacheを照合したうえでproviderへ送るrequest数と推定input tokenを表示する（cacheは書き換えない）。2段目は1段目の結果で決まるため含めない。`--no-cache` を付けると全件送る場合の見積もりになる。
- `inspect` で全件hitした場合はprovider responseが空になる。provider応答を見たいときは `--no-cache` を付ける。
- `doctor` はcache fileのentry数・サイズ・最終利用日時・読めない行数を表示する。
- provider側のprompt / request組み立てを変えたら `TYPESAFE_REQUEST_FORMAT` を、key構成や保存形式を変えたら `cache/decision-cache.ts` の `CACHE_FORMAT_VERSION` を更新する。古いentryはmissになり、保持期間を過ぎると削除される。cacheを捨てたいときは `.semantic-lint/.cache/` を削除する。

実行サマリにはcache hit / miss数、実際に送ったprovider request数・判定数、providerが返したinput token数を表示する。

## Ruleを追加する

静的lintで十分に判定できる規約はsemantic lintへ追加しない。文脈や意味の判断が必要な規約だけを対象にする。

定義したruleは常に `check` で実行する（draft / activeのようなlifecycleはない）。指摘の重さはruleの `severity` で決める。

| severity | 出力（pretty / compact / JSON） | 実行サマリの件数 | 実行の失敗 |
| --- | --- | --- | --- |
| `info` | する | 数えない | させない |
| `warning`（省略時） | する | 数える | させない（`--fail-on warning` のときだけ失敗） |
| `error` | する | 数える | させる（exit code 1） |

追加手順:

1. 対応する人間向け規約が `.claude/rules/*.md` に存在することを確認する。semantic rulesetを規約の正本にしない。
2. 適用pathを共有できる既存rulesetがあれば `.semantic-lint/rules/<ruleset>.yaml` にruleを追加する。共有できなければ新しいrulesetを作る。rulesetに書けるのは `version`、`id`、対象の `paths`、除外する `exclude`、`rules` だけ。対応する人間向け規約はrulesetの先頭のコメントに書く。
3. ruleには `id`、`title`、`unit`、`violationThreshold`、`instruction`、必要なら `severity` だけを書く。新規ruleは原則 `severity` を省略（warning）して始める。`unit` は「unit語彙」の名前から選ぶ。scope・selector・AST node・文脈の取り方・指摘位置の決め方は書かない（未知のkeyは読み込みエラーになる）。
4. `.semantic-lint/cases/<ruleset>/cases.yaml` とfixtureへ、少なくとも明確な `violation` と `no_violation` を追加する。実運用で境界例が見つかったらgolden caseへ追加する。
5. `doctor` と `inspect --plan-only` でpath / unit / subject / request payloadを確認する。
6. `eval <rule-id> --repeat 10` でChoiceと違反確率の揺れを見る。
7. 実repo goldenを追加し、`bench` で採点して校正したthresholdを書く。thresholdは単一fixtureへ合わせない。
8. `check` で実repositoryへ適用し、誤検知・見逃し・unknownを確認する。

`instruction` にはruleの判定基準を英語で書く。先頭に規約を1文で述べ、続けて `Violation:` に違反とみなすもの、`Not a violation:` に紛らわしいが違反ではないもの（許可する書き方、ruleが当てはまらないsubjectなど）を簡潔に書く。判定の選択肢と説明は全ruleで共通のため、ruleには書かない（「判定の質問」を参照）。

rule追加でTypeScript実装は変更しない。必要なunitが語彙にない場合は、`catalog/units.yaml` へ語彙を、`catalog/frameworks/` または `catalog/syntax/` へqueryを追加する。変数名・引数・属性・文字列・コメントなど文より細かい位置を指摘するruleは、その位置を `report` で宣言したunitを使う（なければ語彙とqueryを追加する）。ruleには `unit: variable` のように書くだけで、位置の決め方は書かない。

`variable` のように数の多いunitは質問数がそのまま増える（1 unitあたり推定約250〜350 input token）。追加前に `check --plan-only --no-cache` でrepository全体の推定tokenを確認する。

### 評価専用のruleset

人間向け規約に正本がなく本番へ入れないが、判定方式の評価に使うruleは、`.semantic-lint/config.yaml` の `evalRulesDir`（既定の設定では `.semantic-lint/eval-rules/`）に置く。`bench` と `doctor` だけが読み、`check` / `inspect` では実行しない。goldenは通常どおり `.semantic-lint/golden/` に置く。

`paths` と `exclude` はrepository root基準のglobで、`exclude` はそのrulesetの全ruleに適用する。人間向け規約が適用除外を定めているpath（shadcn/uiの上流コードなど）や生成物は `exclude` に書く。全rulesetで対象にしないpath（`node_modules` や秘密情報など）は `.semantic-lint/config.yaml` の `excludePaths` に書く。

最小のrule例:

```yaml
# 人間向け規約の正本: .claude/rules/vitest.md
version: 1
id: vitest
paths:
  - frontend/**/*.test.ts
exclude: # 省略可
  - frontend/src/components/ui/**
rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    unit: test
    severity: warning # info / warning / error。省略時はwarning
    violationThreshold: 0.35
    instruction: |
      A test body must not perform meaningful Arrange work. Such setup belongs
      in an enclosing describe, beforeEach, or test.each case data.
      Violation: the test body constructs test data or initial state, creates
      mocks or spies, or performs initial rendering.
      Not a violation: using values received from test.each parameters; ...
```

ルール拡充は #323 で追跡する。

## 実repo golden

`.semantic-lint/golden/<ruleset>/<rule-id>.yaml` は、実repoのファイルに対して規約違反として指摘されるべき行範囲を記録する。判定方式に依存しない形式で、自作fixtureより優先して精度評価の基準にする。

```yaml
version: 1
rule: vitest/arrange-outside-test
baseCommit: <ラベルを確認したcommit>
files:
  - path: frontend/src/records/storage.test.ts
    blob: <git hash-object の値>
    findings:
      - lines: [34, 34]
  - path: frontend/src/games/problem-seed.test.ts
    blob: <git hash-object の値>
    findings: [] # 指摘なしが正解
```

指摘位置を宣言したunitのruleでは、同じ行の別の名前と区別するため `columns: [開始列, 終了列]`（1始まり、両端を含む）も書く。

```yaml
    findings:
      - lines: [4, 4]
        columns: [9, 12] # const data = ... の data
```

- 実repoに違反が少ないruleは、`.semantic-lint/golden/<ruleset>/fixtures/` の最小fixtureで違反例を補い、実repoの違反なしファイルを必ず含めてprecisionを測る。

- `blob` はラベルを付けた時点のファイル内容を固定する。working treeが変わっても `bench` はそのblobを `git cat-file` で読んで評価するため、Git履歴にblobが必要。
- working treeとblobが異なるファイルは `doctor` と `bench` がwarningを出す。ラベルを見直してから `blob` と行範囲を更新する。
- `bench` はgoldenの対象ファイルだけを、現行のrule定義とthresholdで評価する。thresholdを掃引するため、2段目はthreshold未満も含めて違反と判定した全unitについて問う（`check` より2段目のrequestが少し多い）。`check` と同じくfileごとに1 requestへまとめ、各fileではそのfileをgoldenに持つruleだけを判定する。
- ruleごとのinput tokenは、requestの実usageを見積もりの内訳（質問はそのrule、stateとrequest固定費は質問数の比）で按分した値。request全体の実測と推定の比は `usage` に出る。
- `--plan-only` はproviderを呼ばずにbenchのrequest数と推定input tokenを出す。`--format summary` はruleごとの主要指標とrequestごとの推定・実usageをJSON 1行ずつ出す。

`bench` の指標:

- file: 指摘の有無だけを比較するprecision / recall。
- 包含(unit): 違反と判定したunitの範囲が期待行範囲を含めば一致。1段目の判定だけの精度。
- 包含(箇所): 違反箇所の指摘が期待行範囲を含めば一致。
- 厳密: 違反箇所の指摘の開始行と終了行が `--line-tolerance` (既定1) 以内なら1対1で一致。期待範囲が `columns` を持つときは行と列の完全一致だけを一致とする。`check` の出力と同じ指摘で採点する。
- 包含は、両方が列を持つときは列まで比べ、どちらかが列を持たなければ行だけで比べる。
- findingsの全run共通数とrunによる揺れ、判定分布、provider request数、input / output tokens、threshold sweep。
- 校正: 厳密一致のF1が最大になるthreshold（同点なら包含(unit)のF1、それでも同点なら中央）を推奨値として出す。gapは違反候補の最低scoreとクリーン候補の最高scoreの差、headroomは推奨値から最高クリーンscoreまでの距離。
- LOFO CV: 1ファイルを外して校正したthresholdでそのファイルを採点し、全ファイルを合わせた包含(unit) / 厳密P/R。ruleのthresholdは全体の推奨値ではなく、CVで性能を確認したうえで決める。

## CI

GitHub ActionsのQuality Gateでは、tool自身のtypecheck / deterministic test / doctor / inspectをPRとmainへのpushで実行する。TypeSafe providerを使う通常の `check` は、provider課金を抑えるためmainへのpushと手動実行（workflow_dispatch）でだけ実行し、PRでは実行しない。

Quality Gateは `actions/cache/restore` で `semantic-lint-v2-` から始まる最新の判定cacheを復元してから `check` を実行し、`actions/cache/save` で実行ごとに新しいkey（`semantic-lint-v2-<run_id>-<run_attempt>`）として保存する。lintが失敗した実行でもcacheを保存し、中断前に得た判定を次回へ引き継ぐ。cache形式やkey構成を互換性なく変えたときはprefixの版を上げる。

remote semantic lintはChatGPT用のoffline verificationでは実行しない。ChatGPT用Offline Dependenciesにもsemantic lintの `node_modules` は含めない。

通常のruleはwarningから運用を始めるため、info / warningだけではQuality Gateを失敗させない。`severity: error` の指摘と、provider/config/internal errorはrun failureになる。
