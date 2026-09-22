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
# active ruleを実行
bun run --cwd tools/semantic-lint check

# directory / fileを限定
bun run --cwd tools/semantic-lint check -- frontend/src/games/nanpure

# draft ruleも含める
bun run --cwd tools/semantic-lint check -- --include-draft

# rule一覧
bun run --cwd tools/semantic-lint rules

# providerを呼ばず、rule / subject / request planを確認
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

# 設定・source・scopeの整合性確認
bun run --cwd tools/semantic-lint doctor

# tool自身の決定論的検証
bun run --cwd tools/semantic-lint typecheck
bun run --cwd tools/semantic-lint test
```

CLIのpath引数はrepository root基準で解決する。

## 仕組み

ruleは対象pathとscopeを宣言する。scope adapterがsourceから判定対象の `Subject` を決定論的に抽出し、providerはそのsubjectがpredicateを満たすかだけを判定する。

行範囲やsymbolはmodelに生成させない。Vitestのtest / beforeEach / describeはTypeScript ASTから抽出する。

provider結果へruleのthresholdを1回だけ適用し、canonicalな `Finding` を作る。pretty / compact / JSON出力はこのFindingから生成する。prettyではFinding同士をmergeせず、同一ruleの表示窓が重なる場合だけcode frameを共有する。

rule lifecycleは次の3つ。

- `draft`: 明示的な `--include-draft`、`eval`、`inspect` で試す段階。
- `active`: 通常の `check` 対象。
- `disabled`: 定義は残すが実行しない。

severityの `warning / error` はlifecycleとは別に管理する。

## Ruleを追加する

静的lintで十分に判定できる規約はsemantic lintへ追加しない。文脈や意味の判断が必要な規約だけを対象にする。

追加手順:

1. 対応する人間向け規約が `.claude/rules/*.md` に存在することを確認する。semantic rulesetを規約の正本にしない。
2. 適用pathとsource documentを共有できる既存rulesetがあれば `.semantic-lint/rules/<ruleset>.yaml` にruleを追加する。共有できなければ新しいrulesetを作る。
3. 新規ruleは `status: draft`、原則 `severity: warning` で開始する。
4. ruleには `id`、`title`、`scope`、`sourceSection`、predicateの `instruction` と4 outcomesを定義する。
5. `.semantic-lint/cases/<ruleset>/cases.yaml` とfixtureへ、少なくとも明確な `violation` と `compliant` を追加する。指摘位置まで正解が明確なcaseでは `expectedFindings` も定義する。実運用で境界例が見つかったらgolden caseへ追加する。
6. `doctor` と `inspect --plan-only` でpath / scope / subject / request planを確認する。
7. `eval <rule-id> --repeat 10` でChoice・違反確率・定義済みcaseの指摘位置一致を見る。
8. `check --include-draft` で実repositoryへ適用し、誤検知・見逃し・unknownを確認する。
9. 十分に運用できると判断したら `status: active` へ変更する。thresholdは単一fixtureへ合わせず、golden corpusと実コードの両方を見て決める。


Golden caseの `expectedFindings` は、fixture内の一意な文字列または明示的なrangeで期待位置を表す。文字列が複数回現れる場合は `occurrence` を指定する。

```yaml
expectedFindings:
  - text: const values = [1, 2, 3];

# 同じ文字列の2件目
  - text: hoge
    occurrence: 2

# 必要な場合だけrangeを直接指定
  - range:
      startLine: 3
      startColumn: 5
      endLine: 3
      endColumn: 30
```

`expectedFindings: []` はfindingが0件であることを期待する。未指定caseでは位置一致を評価しない。

4 outcomesは固定。

- `violation`: 規約違反。
- `compliant`: 規約に適合。
- `not_applicable`: subjectにその規約を適用する意味がない。
- `insufficient_context`: 与えたcontextだけでは判断できない。

新しいscopeが必要な場合だけ `tools/semantic-lint/scopes/` の実装を追加する。通常のrule追加でTypeScript実装を変更しない。

ルール拡充は #323 で追跡する。

## CI

GitHub ActionsのQuality Gateでは、tool自身のtypecheck / deterministic test / doctor / inspectに加えて、TypeSafe providerを使う通常の `check` も実行する。

remote semantic lintはChatGPT用のoffline verificationでは実行しない。ChatGPT用Offline Dependenciesにもsemantic lintの `node_modules` は含めない。

通常のruleはwarningから運用を始めるため、warningだけではQuality Gateを失敗させない。provider/config/internal errorはrun failureになる。

## 検出方式PoC

Candidate + Anchor方式は本番の`check`経路と分離して評価する。

```sh
# providerを呼ばず、benchmarkと実repositoryのcandidate数を確認
bun run --cwd tools/semantic-lint poc -- candidate-anchor --plan-only

# benchmark fixtureをJevで評価
bun run --cwd tools/semantic-lint poc -- candidate-anchor --repeat 3

# Candidate / AnchorごとのChoiceと確率を確認
bun run --cwd tools/semantic-lint poc -- candidate-anchor --repeat 3 --verbose

# PoC predicateを実リポジトリへ1回適用
bun run --cwd tools/semantic-lint poc -- candidate-anchor --repository

# 別benchmarkを同じ方式・設定で評価
bun run --cwd tools/semantic-lint poc -- candidate-anchor \
  --benchmark .semantic-lint/poc/holdout/benchmark.yaml \
  --repeat 10
```

`candidate-anchor` PoCはASTから汎用Candidateと指摘可能なAnchorを抽出する。全Candidateを意味判定し、violationになったCandidateだけAnchorを追加判定する。結果は`.semantic-lint/poc/benchmark.yaml`の期待位置と比較する。本番ruleの`scope`や`check`挙動は変更しない。

### Relation Group PoC

2Eでは、単一AST nodeだけではなく、同じ構文コンテナ直下に並ぶ複数statementの関係を1つの判定対象として追加する。rule設定は変更せず、relation/groupの抽出と位置候補は汎用エンジン側で構成する。

```sh
# Candidate + Anchorへrelation/group候補を追加した静的計画を確認
bun run --cwd tools/semantic-lint poc -- relation-group --plan-only

# 既存benchmarkを同じpredicate・thresholdで比較
bun run --cwd tools/semantic-lint poc -- relation-group --repeat 3

# 未使用holdoutを比較
bun run --cwd tools/semantic-lint poc -- relation-group \
  --benchmark .semantic-lint/poc/holdout/benchmark.yaml \
  --repeat 10

# 実repositoryへ1回適用
bun run --cwd tools/semantic-lint poc -- relation-group --repository
```

`relation-group`は既存の単一Candidateを残したまま、ordered sibling statementsのgroup Candidateを追加する。groupには構文解析器由来のrelation情報と、group自身・包含container・直近の包含statementを位置候補として保持する。Vitest固有のrule IDやcall名による分岐は持たない。本番`check`経路とrule APIは変更しない。

relation自体の成立性をatomic Candidateと分離して確認する場合は `relation-group-only` を使う。

```sh
bun run --cwd tools/semantic-lint poc -- relation-group-only \
  --benchmark .semantic-lint/poc/relation-group/final.yaml \
  --repeat 10
```

この最終benchmarkはrelation target向けpredicate・few-shot境界例・relation専用thresholdをPoC内だけで校正したもの。本番rule YAMLや`check`経路は変更しない。

### Target Family PoC

2EをVitest全体へ広げて検証するため、PoC benchmarkだけに`targetFamily`を持たせ、ruleごとにparserが作る判定単位を切り替える。これはproduction rule APIではなく、target familyごとの性能・coverage・costを比較するための実験設定。

```sh
# 4つのVitest semantic ruleをfamily別に静的計測
bun run --cwd tools/semantic-lint poc -- target-family \
  --benchmark .semantic-lint/poc/target-family/benchmark.yaml \
  --plan-only

# golden corpusを反復評価
bun run --cwd tools/semantic-lint poc -- target-family \
  --benchmark .semantic-lint/poc/target-family/benchmark.yaml \
  --repeat 10

# 同じfamily設定を実repositoryへ適用
bun run --cwd tools/semantic-lint poc -- target-family \
  --benchmark .semantic-lint/poc/target-family/benchmark.yaml \
  --repository
```

現在のfamilyは次の3種類。

- `callback-statement`: callback直下の各statementを個別targetにする。Arrangeのように1つのcallback内で複数findingが必要なrule向け。
- `callback-call`: callbackを持つcall全体をtargetにする。beforeEachやDOM testなどcall単位で意味を判定するrule向け。
- `relation-group`: 同一container直下の構造が揃う兄弟statement群をrelation targetにする。

benchmarkではfinding精度に加え、期待位置を候補Anchorとして生成できた割合を`targetCoverage`として出す。family生成で正解候補を落とした失敗と、Jev分類・位置特定の失敗を分離して評価する。
