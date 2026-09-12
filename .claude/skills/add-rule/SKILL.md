---
name: add-rule
description: >
  This skill should be used when the user asks to "/add-rule", "rule を新規追加", "新しい rule を作る",
  "rule のスキャフォールド", "create a new rule", "scaffold a rule", "add a rule". 直前会話の context
  から目的・name 候補・paths スコープ候補・必達項目草案を推測してユーザー確認を取り、
  `.claude/rules/<name>.md` を生成、rule-reviewer Agent を起動して findings を取得、
  動作確認手順を提示する。
allowed-tools: Read, Write, Edit, Glob, Grep, Task
---

# add-rule

新規 rule ファイルを本リポ規約に沿って追加する Skill。

## 起動

`/add-rule`

引数は受け取らない。直前会話の context から推測する。

## 動作フロー

### 1. Context 推測

- 直前会話 / 既存 rule / 開いている Issue から以下を抽出:
  - **目的**: この rule が必達にしたい項目 (どのファイル編集時に何を遵守させたいか)
  - **name 候補**: ファイル名 (kebab-case 推奨)
  - **paths スコープ候補**: グロブで最小限のスコープ。常時投入なら `paths` 未指定 (ただし常時投入は固定トークンコストのため慎重に)
  - **必達項目草案**: 短い箇条書きで列挙
  - **既存 rule との重複**: `.claude/rules/*.md` を Glob して既存 rule をリストアップし、内容の重複がないか確認
- `.claude/rules/rules.md` を Read して観点を確認する

### 2. 提案

ユーザーに以下を提示して確認を取る:

- `name` (ファイル名)
- `paths` (グロブ配列、または未指定で常時投入)
- 必達項目案 (箇条書き)
- 既存 rule との関係 (重複なし / 既存 rule の更新で代替できないか)

確認が取れるまで Step 3 に進まない。

### 3. Scaffold

- 動的に組み立てた frontmatter (任意の `paths`) + 箇条書き本体を `.claude/rules/<name>.md` に Write
- `description` / `name` フィールドは付与しない (rule 規約)

### 4. Review

Task ツールで `rule-reviewer` Agent を起動し、findings を取得する。Task の `subagent_type` に `rule-reviewer` を指定し、`prompt` にはレビュー対象のフルパス (`.claude/rules/<name>.md`) と「レビューしてください」を渡す。

### 5. Verify (動作確認手順表示)

ユーザーに以下の動作確認手順を提示する:

1. **paths スコープ動作確認**: 「`paths` 該当のファイル (例: `<path-example>`) を Edit ツールで開いて、新 rule がロードされるか確認してください」
2. **`/memory` 確認**: 「`/memory` コマンドで現セッションにロードされている rule 一覧を表示し、新 rule が出ているか確認してください」
3. **常時投入 rule の場合**: 「セッション再起動後、新 rule が読み込まれているか確認してください」

実行は人間が行う (Skill 内では実行しない)。

### 6. ユーザーへ報告

- 作成したパス: `.claude/rules/<name>.md`
- rule-reviewer の findings 要約 (critical / major / minor の件数と主な指摘)
- 動作確認手順 (Step 5 の内容)

## 参照する真実情報

- `.claude/rules/rules.md` — rule 記法ルール (frontmatter / 本文 / アンチパターン)
- `.claude/rules/context-engineering.md` — rule が適切なレイヤーかの判断軸 (rule 起動前提なので原則確認済みだが、提案前に再確認)
- 既存 rule (`.claude/rules/*.md`) — 重複検知 + 同種パターンの参考

## 制約

- 起動 context: inline
- rule 本体で完結すべき規約・手順を `dev/docs/` に逃がさない。rule に複製すべきでない正本データ・仕様・語彙を参照する場合は、正本パスと Read が必要なタイミングを rule 内で明示する
- 採用する設計パターンを 1 つに決め打ちしない
- 既存 rule との内容重複は事前に検知して警告する (重複なら新規追加せず既存 rule の更新を提案)
- 自動コミット / 自動 PR は作成しない
- rule-reviewer の findings に critical があった場合は、ユーザーに修正を促す (自動修正はしない)
