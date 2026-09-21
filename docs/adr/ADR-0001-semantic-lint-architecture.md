# ADR-0001 Semantic lintを運用可能な判定基盤として設計する

- status: proposed
- date: 2026-09-21

## 背景

通常の静的解析では表現しづらいプロジェクト固有の意味的規約を検査するため、TypeSafe AI System One / Jevを使ったsemantic lintのPoCを行った。

PoCでは次を確認できた。

- ファイル全体をcontextとして渡し、複数の意味的ruleをboundedな選択問題として判定できる。
- Vitest規約の実コードに対して、意味的な違反候補を実用的な確率で検出できる。
- 複数ruleを1 requestへまとめても、リポジトリ規模では実用的な実行時間に収まる。
- 決定論的に抽出したtest / describe / hookを再評価すれば、行範囲とsymbolまで位置を絞れる。
- 同一入力でも確率は数ポイント揺れるため、thresholdとruleの校正が必要である。

一方、PoCへ機能を足す過程で、rule loader、calibration、localization、reporter、性能計測が個別に後付けされ、内部domainよりCLI出力や現在の実装都合が先行し始めた。

この状態をそのまま拡張すると、次の問題が大きくなる。

- ruleを追加するたびに設定ファイルやfixture manifestが増え、authoringが煩雑になる。
- providerの概念とsemantic lintのdomainが混ざる。
- ファイル判定と位置特定が別フェーズになり、同じ違反に二種類のthresholdや件数概念が発生する。
- reporter都合で「判定」「警告」「位置候補」の意味が変わりやすい。
- 壊れたときに、rule読み込み、scope抽出、provider request、provider response、threshold適用のどこが原因か追いづらい。
- probabilisticなmodel behaviorの検証と、loader / planner / reporter等の決定論的なテストが混ざる。
- 将来Vitest以外へ広げると、言語・framework固有処理がengineへ漏れやすい。

PoCは技術成立性の確認として扱い、実装互換性は維持しない。必要なら現在のsemantic lint実装はすべて置き換える。

## 判断

semantic lintを「LLM lint CLI」ではなく、次の責務を持つ**意味的判定基盤**として設計する。

1. declarativeなrulesetをcompileする。
2. sourceから決定論的にevaluation subjectを抽出する。
3. ruleとsubjectからEvaluationPlanを作る。
4. providerへbounded decisionを依頼する。
5. provider resultへrule policyを適用し、canonicalなDiagnosticを生成する。
6. canonical resultをconsole / JSON / GitHub等へrenderする。

engine、provider、source adapter、reporterを明確に分離し、通常のrule追加ではTypeScriptコードを変更しない。

## 設計原則

### semantic lint coreはVCSに依存しない

semantic lintはpath / file / directoryを入力として動作する。

Git diff、PR、changed filesは対象選択の上位レイヤーであり、lint semanticsには含めない。CIで差分だけ検査する場合も、外部でpath一覧を作りsemantic lintへ渡す。

### providerはdomainから隔離する

coreはJevの `type: "choice"` やHTTP request schemaを知らない。

domainでは「contextに対してpredicateをbounded decisionする」という抽象だけを扱い、TypeSafe固有request / response、認証、retryはprovider adapterへ閉じ込める。

### diagnosticを先に定義し、文字列出力を正本にしない

console出力はrendererであり、lint結果そのものではない。

engineの正本はversionedなstructured resultとする。

### ruleは自然なscopeで最初から評価する

ファイル全体を一度違反判定し、その後locationを再判定する二段階方式は採用しない。

`arrange-outside-test` ならtest、`before-each-arrange-only` ならbeforeEach、複数testの比較が必要なruleならdescribeまたはfileというように、ruleが意味を持つsubjectを最初から評価する。

これにより、判定結果とdiagnostic locationを同じ1 evaluationとして扱える。

### 構文位置は決定論的に求める

行番号、symbol、subject rangeをmodelに生成させない。

TypeScript / TSX / JavaScriptではparserを使い、ASTからsubjectを抽出する。正規表現による構文抽出はPoC用途に限定し、運用実装では使わない。

### probabilisticな部分とdeterministicな部分を分離する

次は通常のunit / integration testで完全に検証する。

- config / ruleset schema
- rule compilation
- path matching
- scope extraction
- evaluation planning
- batching
- cache key
- diagnostic generation
- reporter
- exit code
- provider request / response mapping

Jev自身のmodel behaviorはgolden corpusを使うevalとして別に測定する。

## authoring model

### ruleset

同じ適用対象と規約sourceを共有するruleを1 ruleset fileへまとめる。

authoring formatはYAMLを採用する。長いpredicateをblock scalarで記述でき、JSONのescape noiseを避けられるためである。

例:

```yaml
version: 1
id: vitest

paths:
  - frontend/**/*.test.{ts,tsx,mjs}

source:
  path: .claude/rules/vitest.md

defaults:
  status: draft
  severity: warning
  violationThreshold: 0.90

rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    scope: vitest.test
    sourceSection: テスト構造 > Arrangeの分離方法
    predicate:
      instruction: |
        Determine whether this test keeps meaningful Arrange setup
        outside the individual test body.
      outcomes:
        violation: |
          The test body performs meaningful Arrange work such as
          constructing test data, initial state, mocks, spies, or
          initial rendering.
        compliant: |
          The test body focuses on Act and Assert. Arrange is prepared
          outside the test body or supplied by test.each parameters.
        not_applicable: |
          This subject does not require meaningful Arrange setup.
        insufficient_context: |
          The available source does not provide enough information to
          distinguish setup from the behavior under test.
```

v1では次をruleset単位で共通化する。

- `paths`
- source document path
- lifecycle / severity / threshold defaults

ruleごとにpathをoverrideする機能は持たせない。適用対象が異なるなら別rulesetとする。

loaderはrulesetをruntime用のflatな `Rule[]` へcompileする。engineはruleset概念を知らない。

### rule lifecycle

ruleには次のstatusを持たせる。

- `draft`: evalと明示実行だけで使用し、通常checkには含めない。
- `active`: 通常checkへ含める。
- `disabled`: 読み込むが実行しない。

severityとは分離する。

- `warning`
- `error`

新規ruleは `draft` から始める。golden corpusと実コードで校正した後に `active` へ昇格する。

### rule追加フロー

既存scopeで表現できるruleの追加は、次だけで完結させる。

1. 対応するrulesetの `rules` へruleを追加する。
2. violation / compliantを含むgolden caseを追加する。
3. `semantic-lint eval <rule-id>` で校正する。
4. 実コードへ明示実行してdiagnosticを確認する。
5. 問題なければ `draft` から `active` へ変更する。

TypeScriptコード変更が必要になるのは、新しいscope extractorまたはproviderを追加するときだけとする。

## scope / subject model

### Subject

providerへ判定させる最小単位を `Subject` と呼ぶ。

```ts
type Subject = {
  id: string;
  scope: ScopeId;
  path: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  symbol?: string;
  source: string;
};
```

`file` もSubjectの一種として扱う。

### Scope adapter

scopeはstring IDでruleから参照する。

初期scope:

- `file`
- `vitest.test`
- `vitest.beforeEach`
- `vitest.describe`

Vitest adapterはTypeScript ASTからsubjectを抽出する。

adapterの責務は次に限定する。

- 対象構文を認識する。
- exact rangeを返す。
- 人間向けsymbolを返す。
- subject sourceを返す。

semantic ruleの意味はadapterへ埋め込まない。

将来React / TypeScript / Python等を追加するときも、engineへframework固有分岐を追加せずscope registryへadapterを登録する。

### full-file context

subjectがtestであっても、providerには必要に応じてファイル全体をcontextとして渡す。

これにより親describeのArrangeやhelper定義を参照できる。

ただし判定対象はquestion内でsubject IDを明示し、別subjectの違反を混同させない。

## EvaluationPlan

source discovery後、providerを呼ぶ前に完全なEvaluationPlanを作る。

```ts
type EvaluationTask = {
  id: string;
  ruleId: string;
  subjectId: string;
};

type PlannedFile = {
  path: string;
  source: string;
  subjects: Subject[];
  tasks: EvaluationTask[];
};

type EvaluationPlan = {
  files: PlannedFile[];
};
```

plan生成はpureかつdeterministicにする。

`inspect` ではproviderを呼ばずplanだけ確認できる。

### batching

同一ファイルのtasksはprovider capabilityの範囲でまとめる。

Jevではstateにfileとsubjectsを1回渡し、questionを `rule × subject` 単位で作る。

これにより、位置特定のための二回目のrequestを不要にする。

providerが扱えるquestion数を超える場合だけdeterministicにchunkする。

## provider boundary

domain側contract:

```ts
type Decision = "violation" | "compliant" | "not_applicable" | "insufficient_context";

type DecisionResult = {
  decision: Decision;
  confidence: number;
  probabilities: Record<Decision, number>;
};

interface SemanticDecisionProvider {
  evaluate(batch: DecisionBatch): Promise<DecisionBatchResult>;
}
```

TypeSafe adapterだけがJev requestへ変換する。

provider adapterの責務:

- authentication
- provider request mapping
- provider response validation
- model identityの記録
- retry / backoff
- provider-level usage / latency取得
- transport errorの分類

retry後も失敗した場合はlint passとして扱わずrun failureにする。

## canonical result

### Evaluation

```ts
type Evaluation = {
  taskId: string;
  ruleId: string;
  subject: Subject;
  result: DecisionResult;
  provider: {
    kind: string;
    model: string;
  };
};
```

### Diagnostic

rule policyをEvaluationへ適用してDiagnosticを作る。

```ts
type Diagnostic = {
  ruleId: string;
  severity: "warning" | "error";
  message: string;
  path: string;
  range: Subject["range"];
  symbol?: string;
  probability: number;
  confidence: number;
  source: {
    path: string;
    section: string;
  };
};
```

`violationThreshold` はdiagnostic生成時に一度だけ適用する。

同じevaluationに「file threshold」と「location threshold」を二重適用しない。

`insufficient_context` はcompliantとして捨てず、run result上のunknownとして保持する。

### RunResult

```ts
type RunResult = {
  schemaVersion: 1;
  diagnostics: Diagnostic[];
  unknowns: Evaluation[];
  metrics: RunMetrics;
};
```

console reporterもGitHub reporterもこの型だけを入力とする。

## CLI

CLIはsubcommandで責務を分ける。

### check

```sh
semantic-lint check
semantic-lint check frontend/src/games
semantic-lint check --files-from paths.txt
```

通常利用。

引数なしではactive ruleのpathsを走査する。

`--files-from` によりGit等の外部selectorからpath一覧を渡せるようにし、coreはVCS非依存を維持する。

### eval

```sh
semantic-lint eval
semantic-lint eval vitest/arrange-outside-test
semantic-lint eval vitest/arrange-outside-test --repeat 10
```

golden corpusに対するmodel behaviorを測る。

evalはcacheを使わず、run-to-run varianceを観測可能にする。

### inspect

```sh
semantic-lint inspect vitest/arrange-outside-test frontend/src/foo.test.ts
```

ruleが壊れたときの主要debug command。

順番に次を表示できるようにする。

1. compile後のrule
2. path match結果
3. 抽出したsubjectsとrange / symbol
4. EvaluationPlan
5. providerへ送るpayload
6. raw provider response
7. threshold適用後のDiagnostic

API key等のsecretは必ずredactする。

`--plan-only` ではproviderを呼ばない。

### rules

```sh
semantic-lint rules
semantic-lint rules vitest
```

rule ID、status、severity、scope、threshold、sourceを一覧する。

### doctor

```sh
semantic-lint doctor
```

schema、source document、scope registration、provider設定、必要な環境変数を検証する。

## output

### pretty

人間向けdefault。

同じfileのdiagnosticをgroupするが、内部件数はDiagnostic件数と一致させる。

例:

```text
frontend/src/records/storage.test.ts

  33:1-42:3  warning  テスト本体にArrangeを置かない
              vitest/arrange-outside-test  violation=96% confidence=95%

1 warning
```

### compact

CI logやeditor向けに1 diagnostic 1行。

```text
frontend/src/records/storage.test.ts:33:1-42:3 warning vitest/arrange-outside-test テスト本体にArrangeを置かない
```

### JSON

versioned `RunResult` をそのまま出力する。

他ツール連携はpretty textをparseせずJSONを使う。

### GitHub

GitHub annotation / review integrationはDiagnosticから生成するadapterとする。GitHub APIやdiffの概念をengineへ入れない。

## metrics

件数の意味を固定する。

- scanned files
- subjects
- planned evaluations
- provider requests
- provider decisions
- cache hits / misses
- diagnostics
- unknowns
- input tokens
- total wall time
- provider latency p50 / p95 / max

「lint判定」と「location判定」のような実装フェーズ由来の指標は作らない。

## cache

checkではprovider costと待ち時間を抑えるためdecision cacheを利用可能にする。

cache keyは少なくとも次を含める。

- engine protocol version
- provider kind
- model identity
- compiled rule hash
- scope adapter version
- full context hash
- subject hash

失敗responseはcacheしない。

mutableなmodel aliasしか使えない場合は、無期限cacheをしない。TTLまたは明示的なcache bustを使う。

evalは常にcache bypassを既定とする。

## failure policy

### exit code

- `0`: error diagnosticなし。
- `1`: error diagnosticあり、または明示された `--fail-on` policyに該当。
- `2`: config / parser / provider / internal errorでrunを完遂できない。

warningは既定でexit 0。

### provider failure

timeout、429、5xxはbounded retryする。

retry上限を超えたらrun failureとする。対象fileを「問題なし」として扱わない。

### insufficient context

`insufficient_context` はunknownとして集計・表示する。

必要に応じてCIで `--fail-on-unknown` を選択可能にする。

## golden corpus / calibration

case manifestはruleset単位で管理する。

```yaml
version: 1
ruleset: vitest

cases:
  - rule: arrange-outside-test
    name: test内で入力データを構築する
    fixture: fixtures/arrange-outside-test/violation.ts
    expected: violation
    origin:
      path: frontend/src/records/storage.test.ts
      note: 実repoで検出した代表例
```

`origin` はprovenanceであり、eval時に現行repo fileを直接参照しない。fixtureはstableなsnapshotとして保持する。

active ruleには原則として少なくとも次を持つ。

- 明確なviolation
- 明確なcompliant
- 誤検知しやすいnegative boundary
- 見逃しやすいpositive boundary

evalは次をruleごとに出す。

- exact decision accuracy
- threshold accuracy
- probability min / mean / max
- threshold crossing count
- unknown count
- token usage
- latency

thresholdを単一caseへfitさせない。threshold変更はcorpus全体と実コードの両方を確認して行う。

## テスト戦略

### deterministic test

通常CIで実行する。

- ruleset schema validation
- compiler
- path selection
- TypeScript/Vitest AST extractor
- range / symbol
- planner
- batching
- fake providerによるengine integration
- threshold policy
- RunResult
- pretty / compact / JSON reporter
- exit code
- retry policy
- cache

### provider contract test

実API responseを模したfixtureまたはfake HTTP serverで、TypeSafe adapterのrequest / response mappingを検証する。

通常CIでAPIへ接続しない。

### remote eval

Jev APIを使うgolden corpus evalは通常のverifyから分離する。

必要なタイミングで手動実行し、将来的にはsecretを持つscheduled workflowでmodel driftを観測できるようにする。

remote evalの揺れを通常CIのpass/failへ直接結びつけない。

## directory structure

目標構成:

```text
.semantic-lint/
├── config.yaml
├── rules/
│   ├── vitest.yaml
│   └── ...
└── cases/
    ├── vitest/
    │   ├── cases.yaml
    │   └── fixtures/
    └── ...

tools/semantic-lint/
├── cli/
├── domain/
├── config/
├── planning/
├── scopes/
│   ├── registry.ts
│   └── vitest.ts
├── engine/
├── providers/
│   └── typesafe/
├── diagnostics/
├── reporters/
├── cache/
└── testing/
```

ファイル分割は責務境界で行い、単なる1関数1ファイルにはしない。

domain層はBun、HTTP、Jev、console、GitHubをimportしない。

## source documentとの関係

`.claude/rules/*.md` 等の規約文書が人間向け規約の正本であり、semantic ruleはそのうちmodelで判定する部分の実行可能な解釈である。

ruleには必ずsource pathとsectionを持たせる。

`doctor` / deterministic validationでsource fileの存在を確認する。可能な範囲でsection headingの存在も検証し、規約文書のrenameによるsilent driftを防ぐ。

semantic ruleset自体を規約の正本にはしない。

## セキュリティ

外部providerへsource codeを送るため、対象pathは明示的なruleset selectorに限定する。

secret、credential、生成物等を誤って対象に含めないよう、config-level excludeを持たせる。

debug outputではAuthorization header、API key、環境変数値を出力しない。

## 実装順序

PoCコードを温存することを目的にしない。次の順で新しいcoreを組み立てる。

1. domain typesとRunResultを定義する。
2. YAML ruleset schema / compiler / validationを作る。
3. Scope registryとTypeScript ASTベースのVitest adapterを作る。
4. EvaluationPlanを作るplannerを実装する。
5. fake providerでengineを完成させる。
6. pretty / compact / JSON reporterを実装する。
7. TypeSafe providerを新しいcontractへ接続する。
8. `check` / `rules` / `doctor` / `inspect` を実装する。
9. golden corpusと `eval` を接続する。
10. cacheを追加する。
11. PoC実装を削除し、新実装だけを残す。
12. 実repoで校正し、ruleを `draft` から `active` へ昇格する。

各段階でdeterministic testを先に整え、remote Jev requestがないと検証できない構造にしない。

## 採用しないもの

### ファイル判定後にlocationを再判定する方式

同じruleに二種類の判定とthresholdが生まれ、warning件数とlocation件数の意味が崩れるため採用しない。

### provider responseを直接consoleへ出すengine

出力変更がdomain変更へ波及するため採用しない。

### 1 rule = 1 config file

rule数に比例してファイルと共通設定の重複が増えるため採用しない。

### regexを使ったTypeScript構文scope抽出

template literal、comment、member call等で壊れやすく、運用時のdebug costが高いため採用しない。

### Git diffをsemantic lintの意味論へ含める

lint対象とVCS状態が結合し、ローカル、CI、他VCSで同じrule semanticsを再利用できなくなるため採用しない。

## 帰結

この設計では、PoCより初期実装量は増える。

その代わり、rule authoring、debug、provider差し替え、output連携、scope追加、model calibrationを独立して扱える。

semantic lintが長期運用される場合の主要な変更点を、次の三種類へ分離できる。

- 規約変更: ruleset / golden corpusを変更する。
- 構文理解の変更: scope adapterを変更する。
- 判定backendの変更: provider adapterを変更する。

engineとDiagnostic contractはこれらから独立させる。
