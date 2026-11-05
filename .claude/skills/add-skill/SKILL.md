---
name: add-skill
description: >
  会話の流れから新しいスキルを .claude/skills/ に作り、skill-reviewer の指摘を添えて報告する。
  「スキルを追加して」「新しいスキルを作って」「add a skill」「create a new skill」と頼まれたときに使う。
---

# add-skill

1. `.claude/rules/skills.md` を読む
2. `.claude/rules/context-engineering.md` を読み、手順の置き場所がスキルで合っているかを確かめる。合っていなければ、置くべき場所と理由をユーザーに伝え、スキルとして作るかをユーザーに決めてもらう。作らないときは終える
3. `.claude/skills/*/SKILL.md` を Glob して既存のスキルを読み、同じ作業を扱うスキルを探す
4. 会話からスキル名・`description` とほかのフロントマター（`allowed-tools`・`disable-model-invocation` など）・手順・補助ファイルの案を作る。同じ作業を扱うスキルがあるときは、そのスキルを直す案にする
5. 案をユーザーに見せ、了承を得てから次に進む
6. skills.md に沿って SKILL.md と補助ファイルを書く
7. `skill-reviewer` エージェントを起動し、書いた SKILL.md のパスを渡す
8. 返った指摘をユーザーに伝え、直すかどうかをユーザーに決めてもらう
9. 書いたファイルのパスと、`/<スキル名>` で起動して確かめられることをユーザーに伝える。コミットはユーザーの指示を待つ
