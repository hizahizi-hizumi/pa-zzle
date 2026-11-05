---
name: adr-create
description: >
  プロジェクト全体の意思決定を MADR v3 ベースの ADR として docs/adr/ に作り、次の連番を振り、
  docs/adr/index.csv に検索用の要約付きの行を足す。引数は日本語の短い ADR タイトル（省略可）で、
  ファイル名には英語の ASCII slug を使う。
  「ADR を作成して」「新規 ADR」「意思決定を記録して」「ADR を起票して」「決定を残したい」
  「create an ADR」「record a decision」「write a decision record」と頼まれたときに使う。
argument-hint: "<日本語タイトル>?"
allowed-tools: Read, Glob, Grep, Bash(date +%Y-%m-%d)
---

# adr-create

1. `docs/adr/README.md` と `docs/adr/index.csv` があるかを確かめる。どちらかが無ければ、ADR の置き場所が揃っていないことをユーザーに伝えて終える
2. `docs/adr/README.md` を読み、ADR にする意思決定の範囲・`status`・置き換えの決まりを確かめる
3. 記録したい判断が README の範囲に当たるかを確かめる。範囲外の判断と、単発のバグ修正・局所的なリファクタリング・誤字修正・単純なデータ追加は ADR にせず、コミットと PR の履歴で足りることをユーザーに伝えて終える
4. 記録したい判断の論点を表すキーワード（技術名・概念名など）を会話から選び、それぞれを引数にして `adr-reference` スキルを起動し、同じ論点の既存 ADR を探す。見つかったら、新しい ADR がその全体を置き換えるか、一部を置き換えるか、補うかを決める
5. `docs/adr/ADR-*.md` を Glob し、ファイル名の `NNNN` の最大値に 1 を足して4桁にゼロ埋めした番号を新しい番号にする。ADR が無ければ `0001` にする。同じ番号のファイルが2つ以上あれば、その番号をユーザーに伝えて終える
6. `${CLAUDE_SKILL_DIR}/references/madr-authoring-rules.md` と `${CLAUDE_SKILL_DIR}/assets/adr-template.md` を読む
7. タイトルを決める。引数があればそれを使い、無ければ会話から日本語のタイトルを1つ提案してユーザーに確かめる
8. madr-authoring-rules.md の「ファイル名規約」に沿って slug とファイル名を決める
9. `date +%Y-%m-%d` で今日の日付を得る
10. adr-template.md を元に、madr-authoring-rules.md の「章立てルール」に沿って本文を書く
    - 会話から埋められるところを埋め、決まっていない点は本文に書く
    - 手順 4 で置き換えると決めたときは、どの ADR のどの部分を置き換えるかを `## 補足` に書く
11. madr-authoring-rules.md の「summary の書き方」に沿って、書いた本文から summary を作り、`## 要約` の `要約` に入れる
12. `docs/adr/ADR-<NNNN>-<ascii-slug>.md` を Write する
13. madr-authoring-rules.md の「index.csv 追記行」に沿って、`docs/adr/index.csv` の末尾に1行を Edit で足す。`summary` には手順 11 と同じ文字列を入れる
14. 書いた ADR の `status`・`date`・タイトルと index.csv の行が一致し、`要約` と `summary` が同じ文字列であることを確かめる
15. 次をユーザーに伝える。コミットと PR はユーザーの指示を待つ
    - 作った ADR のパス
    - index.csv に足した行
    - `status`。`proposed` のときは残っている判断点
    - 既存 ADR を置き換えるときは、README の「置き換え」に沿って旧 ADR と index.csv の旧い行に要る操作。旧 ADR の `status`・`partially_superseded_by`・置き換えの注記と index.csv の旧い行は自分では書き換えない
    - 決定によって今の決まりが変わるときは、直す必要があるコードと文書の候補
