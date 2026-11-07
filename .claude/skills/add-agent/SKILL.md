---
name: add-agent
description: >
  会話の流れから新しいエージェント定義を .claude/agents/ に作り、agent-reviewer の指摘を添えて報告する。
  「エージェントを追加して」「新しいエージェントを作って」「add an agent」「create a new agent」と頼まれたときに使う。
---

# add-agent

1. `.claude/rules/agents.md` を読む
2. `.claude/rules/context-engineering.md` を読み、作業の置き場所がエージェントで合っているかを確かめる。合っていなければ、置くべき場所と理由をユーザーに伝え、エージェントとして作るかをユーザーに決めてもらう。作らないときは終える
3. `.claude/agents/*.md` を Glob して既存のエージェントを読み、同じ作業を任せているエージェントを探す
4. 会話から `name`・`description`・`tools` とほかのフロントマター・本文の案を作る。同じ作業を任せているエージェントがあるときは、そのエージェントを直す案にする
5. 案をユーザーに見せ、了承を得てから次に進む
6. agents.md に沿ってエージェント定義を `.claude/agents/<name>.md` に書く
7. `agent-reviewer` エージェントを起動し、書いたエージェント定義のパスを渡す
8. 返った指摘をユーザーに伝え、直すかどうかをユーザーに決めてもらう
9. 書いたファイルのパスと、Agent ツールで `subagent_type` に `<name>` を指定して起動して確かめられることをユーザーに伝える。コミットはユーザーの指示を待つ
