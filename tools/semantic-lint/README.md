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

# 判定cacheを使わずにproviderへ送り直す
bun run --cwd tools/semantic-lint check -- --no-cache

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

## 判定cache

`check` と `inspect` は、providerの判定結果をrepository rootの `.semantic-lint/.cache/decisions.jsonl` に保存し、providerへ送る内容が同じ判定を再利用する。`.semantic-lint/.cache/` はGit管理しない。

保存するのはthreshold適用前のprovider判定（Choiceと4 outcomeの確率、confidence、応答したprovider / model）。thresholdは実行ごとにcacheから読んだ判定へ適用するため、thresholdやseverityを変えても再判定しない。

cache keyはrule × subject単位で、providerへ送る1判定分の入力を決める次の要素のSHA-256とする。

- provider種別、設定上のmodel、provider側のprompt / request組み立ての版（TypeSafeでは `TYPESAFE_REQUEST_FORMAT`）
- ruleのscope、predicateの `instruction` と4 outcomesの文面
- 文脈として送るfileのpathと全文
- subjectのid / scope / path / symbol / source

threshold、severity、status、rule id、行番号（subject range）はkeyに含めない。subject rangeはfile全文とsubject idから決まる。

providerへの送信はfileごとのbatchだが、hit / missはtaskごとに判定し、missしたtaskだけでbatchを組み立てる。現在は文脈としてfile全文を送るため、fileを1文字でも変えるとそのfileの全subjectがmissになる。変更のないfileと、rule文面を変えていないruleの判定は再利用する。

新しい判定はprovider応答ごとに追記するため、途中で失敗した実行で得た判定も次回に使える。実行完了時にcacheを書き直し、重複を畳んで、最終利用から30日を過ぎたentryと50,000件を超えた古いentryを削除する。読めない行や形式の合わないentryは無視してmissとして扱い、次の書き直しで削除する。

- `--no-cache`: cacheを読まず、書きもしない。
- golden caseで判定の揺れを測る `eval` はcacheを使わない。
- `inspect` で全件hitした場合はprovider responseが空になる。provider応答を見たいときは `--no-cache` を付ける。
- `doctor` はcache fileのentry数・サイズ・最終利用日時・読めない行数を表示する。
- provider側のprompt / request組み立てを変えたら `TYPESAFE_REQUEST_FORMAT` を、key構成や保存形式を変えたら `cache/decision-cache.ts` の `CACHE_FORMAT_VERSION` を更新する。古いentryはmissになり、保持期間を過ぎると削除される。cacheを捨てたいときは `.semantic-lint/.cache/` を削除する。

実行サマリにはcache hit / miss数、実際に送ったprovider request数・判定数、providerが返したinput token数を表示する。

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

## CI

GitHub ActionsのQuality Gateでは、tool自身のtypecheck / deterministic test / doctor / inspectをPRとmainへのpushで実行する。TypeSafe providerを使う通常の `check` は、provider課金を抑えるためmainへのpushと手動実行（workflow_dispatch）でだけ実行し、PRでは実行しない。

Quality Gateは `actions/cache/restore` で `semantic-lint-v1-` から始まる最新の判定cacheを復元してから `check` を実行し、`actions/cache/save` で実行ごとに新しいkey（`semantic-lint-v1-<run_id>-<run_attempt>`）として保存する。lintが失敗した実行でもcacheを保存し、中断前に得た判定を次回へ引き継ぐ。cache形式やkey構成を互換性なく変えたときはprefixの版を上げる。

remote semantic lintはChatGPT用のoffline verificationでは実行しない。ChatGPT用Offline Dependenciesにもsemantic lintの `node_modules` は含めない。

通常のruleはwarningから運用を始めるため、warningだけではQuality Gateを失敗させない。provider/config/internal errorはrun failureになる。
