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

# 実repo goldenで現行方式を採点 (providerを呼ぶ)
bun run --cwd tools/semantic-lint bench -- vitest/arrange-outside-test --repeat 3

# 既存のRunResult JSONをgoldenで採点 (providerを呼ばない)
bun run --cwd tools/semantic-lint bench -- --score <run-result.json>

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

provider結果へruleのthresholdを1回だけ適用し、canonicalな `Diagnostic` を作る。pretty / compact / JSON出力はこのDiagnosticから生成する。

rule lifecycleは次の3つ。

- `draft`: 明示的な `--include-draft`、`eval`、`inspect` で試す段階。
- `active`: 通常の `check` 対象。
- `disabled`: 定義は残すが実行しない。

severityの `warning / error` はlifecycleとは別に管理する。

## unit rule

ruleは `scope` の代わりに汎用の `unit` を指定できる。作者が書くのはpaths / predicate / severity / unit (と識別用のid / title / sourceSection) だけで、subject抽出・文脈・位置特定はrule非依存のengineが決める。

```yaml
rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    unit: function
    sourceSection: テスト構造 > Arrangeの分離方法
    predicate:
      instruction: |
        Determine whether this test body keeps meaningful Arrange setup outside it.
      outcomes: { violation: ..., compliant: ..., not_applicable: ..., insufficient_context: ... }
```

| unit | 単位 | 指摘範囲 |
| --- | --- | --- |
| `file` | ファイル。400行を超えるとトップレベル文の境界で分割する | 違反単位内で行IDを選ばせ、その行を含む葉の文 |
| `function` | 構文上の関数 (宣言・式・arrow・method・コールバック引数)。3行未満の関数は外側へ畳む | 違反単位内で行IDを選ばせ、その行を含む関数本体直下の文 |
| `line` | 他の文を含まない文 | 判定した文そのもの |

- unitは構文だけで抽出し、関数名などframework固有の知識で分岐しない。unit語彙は `units/definitions.ts` の `UnitDefinition` (抽出器 + 文脈構築) として登録する。
- 文脈は単位本体 + ファイル概要 (import全文とトップレベル文の先頭行) + 外側の関数を入れ子の本文を畳んだ形。ファイル全文は渡さない。
- 対象外の単位はmodelが `not_applicable` で捨てる前提で、predicateの `not_applicable` に「このruleが扱う種類のコードではない」場合を含める。
- 同じファイル・同じunitに当たる複数ruleの質問は1 requestに相乗りする。
- 入れ子の関数は外側・内側の両方を判定し、位置特定後に外側の指摘が内側の指摘を包含する場合は内側だけを残す。
- 位置特定は `violationThreshold` 以上のviolation単位だけ、行IDのchoice (1質問255選択肢まで。空行・コメント行・記号だけの行は除く) で行う。複数行の文は行の確率を合算する。
- 判定と位置特定の回答は `.semantic-lint/.cache/decisions.json` にキャッシュする。keyはrule文面・unit・文脈モード・対象と文脈のテキスト・modelで、thresholdは含めない。`check --no-cache` で無効にできる。

`bench --rules-from <ruleset>` はgolden `<ruleset>/<id>` を別rulesetの同じidのruleで評価する。unit ruleはthreshold sweepのためthreshold未満のviolationも位置特定する。`--nesting fold|all`、`--context skeleton|file`、`--locate lines|statements` は比較実験用のengine設定でrule定義には書かない。

## Ruleを追加する

静的lintで十分に判定できる規約はsemantic lintへ追加しない。文脈や意味の判断が必要な規約だけを対象にする。

追加手順:

1. 対応する人間向け規約が `.claude/rules/*.md` に存在することを確認する。semantic rulesetを規約の正本にしない。
2. 適用pathとsource documentを共有できる既存rulesetがあれば `.semantic-lint/rules/<ruleset>.yaml` にruleを追加する。共有できなければ新しいrulesetを作る。
3. 新規ruleは `status: draft`、原則 `severity: warning` で開始する。
4. ruleには `id`、`title`、`scope`、`sourceSection`、predicateの `instruction` と4 outcomesを定義する。
5. `.semantic-lint/cases/<ruleset>/cases.yaml` とfixtureへ、少なくとも明確な `violation` と `compliant` を追加する。実運用で境界例が見つかったらgolden caseへ追加する。
6. `doctor` と `inspect --plan-only` でpath / scope / subject / request planを確認する。
7. `eval <rule-id> --repeat 10` でChoiceと違反確率の揺れを見る。
8. `check --include-draft` で実repositoryへ適用し、誤検知・見逃し・unknownを確認する。
9. 十分に運用できると判断したら `status: active` へ変更する。thresholdは単一fixtureへ合わせず、golden corpusと実コードの両方を見て決める。

4 outcomesは固定。

- `violation`: 規約違反。
- `compliant`: 規約に適合。
- `not_applicable`: subjectにその規約を適用する意味がない。
- `insufficient_context`: 与えたcontextだけでは判断できない。

新しいscopeが必要な場合だけ `tools/semantic-lint/scopes/` の実装を追加する。通常のrule追加でTypeScript実装を変更しない。

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

- `blob` はラベルを付けた時点のファイル内容を固定する。working treeが変わっても `bench` はそのblobを `git cat-file` で読んで評価するため、Git履歴にblobが必要。
- working treeとblobが異なるファイルは `doctor` と `bench` がwarningを出す。ラベルを見直してから `blob` と行範囲を更新する。
- `bench` はgoldenの対象ファイルだけを、ruleのstatusに関係なく現行のrule定義とthresholdで評価する。ruleごとに別requestで実行するため、tokenはrule単位で集計される。

`bench` の指標:

- file: 指摘の有無だけを比較するprecision / recall。
- 包含: findingが期待行範囲を含めば一致。test全体などsubject単位の指摘でも一致する。
- 厳密: 開始行と終了行が `--line-tolerance` (既定1) 以内なら1対1で一致。
- findingsの全run共通数とrunによる揺れ、provider request数、input / output tokens、threshold sweep。
- 校正: 包含F1が最大になるthresholdの中央を推奨値とし、違反候補とクリーン候補のscoreから gap (違反群の最低 − クリーン群の最高) と headroom (推奨値 − クリーン群の最高) を出す。過学習を見るため、1ファイルを外して校正し外したファイルで採点するleave-one-file-outの結果も出す。

## CI

GitHub ActionsのQuality Gateでは、tool自身のtypecheck / deterministic test / doctor / inspectに加えて、TypeSafe providerを使う通常の `check` も実行する。

remote semantic lintはChatGPT用のoffline verificationでは実行しない。ChatGPT用Offline Dependenciesにもsemantic lintの `node_modules` は含めない。

通常のruleはwarningから運用を始めるため、warningだけではQuality Gateを失敗させない。provider/config/internal errorはrun failureになる。
