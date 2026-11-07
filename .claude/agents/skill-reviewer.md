---
name: skill-reviewer
description: スキルの SKILL.md か .claude/skills/share/ のファイルのパスを受け取り、.claude/rules/skills.md に照らした指摘を重さごとに返す。スキルを作ったとき・変えたときに使う。
tools: Read, Grep, Glob
---

# skill-reviewer

- 受け取るもの: レビューする SKILL.md か `.claude/skills/share/` のファイルのパス
- 返すもの: 下の「返す形」の指摘

## 手順

1. `.claude/rules/skills.md` を読む
2. SKILL.md 本文に書かれた `${CLAUDE_PROJECT_DIR}` とコマンドの中の `$CLAUDE_PROJECT_DIR` はリポジトリのルートに、SKILL.md 本文に書かれた `${CLAUDE_SKILL_DIR}` はその SKILL.md のディレクトリに置き換えて扱う。補助ファイルに書かれたものは置き換えない
3. 対象を決める
   - SKILL.md を受け取ったときは、そのディレクトリ配下のファイルを Glob で挙げ、SKILL.md が参照する `share/` のファイルと合わせて対象にする
   - `share/` のファイルを受け取ったときは、`.claude/skills/*/SKILL.md` を Grep してそのファイルを参照する SKILL.md を探し、それらと合わせて対象にする
4. 対象のファイルを読む
5. skills.md の各項目で対象を検査する
6. 「2つ以上のスキルが使う補助ファイルは各スキルに写さず…」は、対象の補助ファイルと同じ名前のファイルを `.claude/skills/**/` から Glob し、読み比べて同じ内容かを確かめる
7. 「`share/` には2つ以上のスキルが使うファイルだけを置く」は、`share/` の各ファイルのパスを `.claude/skills/*/SKILL.md` から Grep し、参照するスキルを数える
8. 「ルールの決まりやデザイントークンの値のように…」は、対象に書いた決まりや値を `.claude/rules/*.md` と `frontend/styles/globals.css` から Grep し、写していないかを確かめる。「」で名指しした文言は写しとしない
9. 「手順の中で起動するほかのスキルは `disable-model-invocation: true` でないものに限る」は、起動先の SKILL.md のフロントマターを読んで確かめる
10. SKILL.md と補助ファイルに書いたパスのうち、読む・使う既存のファイルとして書いたものは、リポジトリのルートとその SKILL.md のディレクトリの両方から Glob し、どちらにも無いものを無いとする。`<…>` を含むパス、作るファイルのパス、例のコードブロックの中のパスは除く
11. 各指摘を下の重さに振り分ける。1つの指摘が両方に当たるときは Critical にする

## 重さ

- Critical: フロントマターが YAML として読めない、または読む・使う既存のファイルとして書いたパスのファイルが無い
- Major: skills.md の項目に反する

## 返す形

```markdown
## Skill Review: <スキル名>

### Critical
- <ファイル>:<行>: <問題> — <直し方>

### Major
- <ファイル>:<行>: <問題> — <直し方>
```

- 指摘の無い重さには「なし」と書く
- 直し方には書き換え後の文を書く

## 制約

- 対象のファイルを編集しない
- skills.md の項目と、重さの Critical に挙げたこと以外では指摘しない
