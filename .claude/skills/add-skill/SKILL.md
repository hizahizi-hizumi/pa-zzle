---
name: add-skill
description: >
  This skill should be used when the user asks to "/add-skill", "Skill を新規追加", "新しい Skill を作る",
  "Skill のスキャフォールド", "create a new skill", "scaffold a skill", "add a skill". 直前会話の context
  から目的・name 候補・description 草案・採用パターンを推測してユーザー確認を取り、
  `.claude/skills/<name>/SKILL.md` を生成、skill-reviewer Agent を起動して findings を取得、
  動作確認手順を提示する。SKILL.md の frontmatter / 章立ては assets テンプレを使わず動的に組み立てる。
allowed-tools: Read, Write, Edit, Glob, Grep, Task
---

# add-skill

新規 Skill を本リポ規約に沿って追加する Skill。

## 起動

`/add-skill`

引数は受け取らない。直前会話の context から推測する。

## 動作フロー

### 1. Context 推測

- 直前会話 / 既存ファイル / 開いている Issue から以下を抽出:
  - **目的**: この Skill が解決する課題、何を自動化するか
  - **name 候補**: 動詞 (or 動詞 + 目的語) を kebab-case で。lowercase + hyphens、64 字以内、予約語 (`anthropic` / `claude` 等) 不可
  - **description 草案**: third-person、起動 trigger 文言を具体的に列挙、英語 trigger を含める (日本語 trigger は任意)
  - **採用パターン候補**: 本体実装 (allowed-tools 指定) か、別 subagent 起動 (`agent` + `context: fork`) か、`disable-model-invocation` で手動起動専用にするか、等
- `.claude/rules/skills.md` を Read して観点を確認する

### 2. 提案

ユーザーに以下を提示して確認を取る:

- `name` (= ディレクトリ名 + 起動コマンド `/<name>`)
- `description` (third-person + 起動 trigger 列挙)
- 採用パターン (frontmatter フィールドの組合せ)
- 章立て案 (動作フロー / 出力先 / 参照する真実情報 / 制約 等)

確認が取れるまで Step 3 に進まない。

### 3. Scaffold

- `.claude/skills/<name>/` ディレクトリを作成
- 動的に組み立てた frontmatter + 章立てを `.claude/skills/<name>/SKILL.md` に Write
- assets / references 等のサブディレクトリは必要に応じて作成 (詳細を分離する場合のみ)

### 4. Review

Task ツールで `skill-reviewer` Agent を起動し、findings を取得する。Task の `subagent_type` に `skill-reviewer` を指定し、`prompt` にはレビュー対象のフルパス (`.claude/skills/<name>/SKILL.md`) と「レビューしてください」を渡す。

### 5. Verify (動作確認手順表示)

ユーザーに以下の動作確認手順を提示する:

1. **trigger 確認**: 「`/<name>` をチャットに入力して起動するか確認してください」
2. **一覧確認**: 「`/skills` で `<name>` が一覧に出ているか確認してください」
3. **挙動確認**: 「実行して期待通りに動作するか確認してください」

実行は人間が行う (Skill 内では実行しない)。

### 6. ユーザーへ報告

- 作成したパス: `.claude/skills/<name>/SKILL.md`
- skill-reviewer の findings 要約 (critical / major / minor の件数と主な指摘)
- 動作確認手順 (Step 5 の内容)

## 参照する真実情報

- `.claude/rules/skills.md` — Skill 記法ルール (frontmatter / 本文 / アンチパターン)
- `.claude/rules/context-engineering.md` — Skill が適切なレイヤーかの判断軸 (Skill 起動前提なので原則確認済みだが、提案前に再確認)
- 既存 Skill (`.claude/skills/*/SKILL.md`) — 同種パターンの参考 (例: adr-create / discover-topics)

## 制約

- 起動 context: inline
- assets テンプレート (skill-template.md 等) は作らず、frontmatter / 章立てを毎回動的に組み立てる
- 採用する設計パターンを 1 つに決め打ちしない (ユーザーの意図に応じて本体 / subagent 起動 / 手動専用 等を選ぶ)
- 自動コミット / 自動 PR は作成しない
- skill-reviewer の findings に critical があった場合は、ユーザーに修正を促す (自動修正はしない)
