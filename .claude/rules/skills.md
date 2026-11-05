---
paths:
  - ".claude/skills/**/*"
---

# スキルの書き方

## SKILL.md と補助ファイル

- 手順は Claude がする動作で言い切る

  ```
  OK:
  1. `references/output-format.md` を読む
  2. `docs/adr/index.csv` から該当する行を探す
  NG:
  1. 出力形式は `references/output-format.md` にある
  2. 必要なら `docs/adr/index.csv` を見るとよい
  ```

- ルールの決まりやデザイントークンの値のようにスキルの外で定まるものは置き場所のパスと読むタイミングだけを書く

## SKILL.md

- SKILL.md は 500 行以下を目安にする
- `description` には何をするかを最初に書く
- `disable-model-invocation: true` でないスキルの `description` にはいつ使うかも書く
- いつ使うかにはユーザーが言いそうな言い回しを日本語と英語で挙げる
- `allowed-tools` には確認なしで使わせたいツールとコマンドだけに一致するパターンを書く

  ```
  OK:
  allowed-tools: Read, Bash(git add *), Bash(git commit *)
  NG:
  allowed-tools: Read, Bash(git *)
  ```

## 補助ファイル

- 起動のたびには要らない詳細は補助ファイルに分ける
- SKILL.md にはそのスキルが使うすべての補助ファイル（同じディレクトリ配下と `share/` のファイル）のパスと読む・使うタイミングを書く
- 採番や形式の検証のように入力が同じなら結果も同じになるべき処理はスクリプトにする

## ほかのスキルとの共有

- 2つ以上のスキルが使う補助ファイルは各スキルに写さず `.claude/skills/share/` に1つだけ置く
- `share/` には2つ以上のスキルが使うファイルだけを置く
- SKILL.md から `share/` のファイルを参照するときは `${CLAUDE_PROJECT_DIR}/.claude/skills/share/<パス>` と書く
- ほかのスキルの手順はそのスキルを起動して使う

  ```
  OK:
  - `commit` スキルを起動してコミットを作る
  NG:
  - `.claude/skills/commit/SKILL.md` を読んで同じ手順でコミットを作る
  ```

- 手順の中で起動するほかのスキルは `disable-model-invocation: true` でないものに限る
