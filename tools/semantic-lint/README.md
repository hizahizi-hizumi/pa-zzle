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
```

`candidate-anchor` PoCはASTから汎用Candidateと指摘可能なAnchorを抽出する。全Candidateを意味判定し、violationになったCandidateだけAnchorを追加判定する。結果は`.semantic-lint/poc/benchmark.yaml`の期待位置と比較する。本番ruleの`scope`や`check`挙動は変更しない。
