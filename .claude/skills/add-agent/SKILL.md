---
name: add-agent
description: >
  This skill should be used when the user asks to "/add-agent", "Agent を新規追加", "新しい Agent を作る",
  "Agent のスキャフォールド", "create a new agent", "scaffold an agent", "add an agent". 直前会話の context
  から目的・name 候補 (動作主名詞 / agent noun)・tools 最小権限・description 草案を推測してユーザー確認を取り、
  `.claude/agents/<name>.md` を生成、agent-reviewer Agent を起動して findings を取得、
  動作確認手順を提示する。
allowed-tools: Read, Write, Edit, Glob, Grep, Task
---

# add-agent

新規 Agent を本リポ規約に沿って追加する Skill。

## 起動

`/add-agent`

引数は受け取らない。直前会話の context から推測する。

## 動作フロー

### 1. Context 推測

- 直前会話 / 既存ファイル / 開いている Issue から以下を抽出:
  - **目的**: この Agent が独立 context で行うべき作業 (大量ファイル探索 / 外部 API 調査 / 並列特化等)
  - **name 候補**: **動作主名詞 (agent noun)** で動作主を表す。動詞から派生する `-er` / `-or` / `-ist` / `-ant` 等の接尾辞を取る名詞 (例: `verify` → `verifier`、`extract` → `extractor`、`discover` → `discoverer`)
  - **description 草案**: third-person、入出力 1〜2 文、起動 trigger 含む
  - **tools 候補**: 最小権限。read-only Agent (調査 / レビュー系) には Write を渡さない
  - **system prompt 章立て**: 役割 / 責務 / 参照する真実情報 / 出力フォーマット / 制約 (priority / 観点別検査手順は該当時のみ)
- `.claude/rules/agents.md` を Read して観点を確認する

### 2. 提案

ユーザーに以下を提示して確認を取る:

- `name` (動作主名詞 / agent noun 形式)
- `description` (third-person + 入出力 1〜2 文 + 起動 trigger)
- `tools` (最小権限で列挙)
- system prompt 章立て案

確認が取れるまで Step 3 に進まない。

### 3. Scaffold

- 動的に組み立てた frontmatter + system prompt 章立てを `.claude/agents/<name>.md` に Write

### 4. Review

Task ツールで `agent-reviewer` Agent を起動し、findings を取得する。Task の `subagent_type` に `agent-reviewer` を指定し、`prompt` にはレビュー対象のフルパス (`.claude/agents/<name>.md`) と「レビューしてください」を渡す。

### 5. Verify (動作確認手順表示)

ユーザーに以下の動作確認手順を提示する:

1. **spawn 確認**: 「Task ツールで `subagent_type: \"<name>\"` を指定して spawn し、期待出力が返るか確認してください」
2. **権限境界確認**: 「Agent が tools で許可していない操作を試行していないか確認してください」
3. **description 整合確認**: 「description で約束した入出力と実際の挙動が一致しているか確認してください」

実行は人間が行う (Skill 内では実行しない)。

### 6. ユーザーへ報告

- 作成したパス: `.claude/agents/<name>.md`
- agent-reviewer の findings 要約 (critical / major / minor の件数と主な指摘)
- 動作確認手順 (Step 5 の内容)

## 参照する真実情報

- `.claude/rules/agents.md` — Agent 記法ルール (frontmatter / system prompt / アンチパターン)
- `.claude/rules/context-engineering.md` — Agent が適切なレイヤーかの判断軸 (Agent 起動前提なので原則確認済みだが、提案前に再確認)
- 既存 Agent (`.claude/agents/*.md`) — 同種パターンの参考 (例: topics-discoverer / verifier / updater)

## 制約

- 起動 context: inline
- 採用する設計パターンを 1 つに決め打ちしない (汎用調査 / レビュー / 特化処理 等、ユーザーの目的に応じて構成する)
- name は必ず動作主名詞 (agent noun)。動詞そのまま / 名詞のみは不可
- 自動コミット / 自動 PR は作成しない
- agent-reviewer の findings に critical があった場合は、ユーザーに修正を促す (自動修正はしない)
