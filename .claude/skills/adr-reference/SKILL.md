---
name: adr-reference
description: >
  docs/adr/ の既存 ADR を ADR-NNNN の ID かキーワードで探し、意思決定の背景・比べた選択肢・理由を示す。
  docs/adr/index.csv を先に検索し、ADR の本文は要るときだけ読む。
  「ADR を参照して」「ADR を見て」「意思決定の経緯を確認して」「既存 ADR を探して」「ADR を検索して」
  「過去の意思決定を確認して」「なぜこう決めたか確認して」「look up an ADR」「search ADRs」
  「find a decision record」「read a decision record」「why did we decide this」と頼まれたときに使う。
argument-hint: "<ADR-NNNN | keyword>"
allowed-tools: Read, Glob, Grep
---

# adr-reference

ADR と `docs/adr/index.csv` は書き換えず、一時ファイルも書き出さない。結果は `${CLAUDE_SKILL_DIR}/references/output-format.md` の形式で会話に示す。

1. 引数が無ければ、ID かキーワードを指定するようユーザーに求めて終える
2. `docs/adr/README.md` を読み、`status` と置き換えの決まりを確かめる
3. `${CLAUDE_SKILL_DIR}/references/output-format.md` を読む
4. 引数が `^ADR-\d{4}$` に一致すれば手順 5 の ID 指定、それ以外は手順 6 のキーワード検索で探す
5. ID 指定
   1. `docs/adr/ADR-<NNNN>-*.md` を Glob する
   2. 0件なら output-format.md の ID 指定0件の形式で示して終える
   3. 2件以上なら連番の重複として、該当するパスを並べて終える
   4. 1件ならそのファイルを読み、output-format.md の ID 指定1件の形式で front matter と本文を示す。`status` が `superseded by ADR-NNNN` のときと front matter に `partially_superseded_by` があるときは、`docs/adr/index.csv` をその ID で Grep して summary を得て、本文より前に output-format.md の「supersede 状態」の形式で置き換えを示す
6. キーワード検索
   1. `docs/adr/index.csv` をキーワードで Grep し、ヒットした行を候補にする
   2. index.csv で0件のとき、summary に出にくい固有名詞・数値・コード断片を探すとき、ユーザーが本文の検索を求めたときだけ、`docs/adr/ADR-*.md` を Grep する。本文でヒットした ADR の summary は index.csv の行から得る
   3. 候補をファイル単位でまとめる
   4. `docs/adr/ADR-*.md` を `^partially_superseded_by:` で Grep し、候補のうち一部を置き換えられた ADR を見つける。その ADR は front matter と表題直後の置き換えの注記だけを読み、置き換え先と置き換えた部分を得る
   5. output-format.md のキーワード検索の形式で示す。`status` が superseded の ADR と、一部を置き換えられた ADR には「supersede 状態」の形式で置き換え先を示す
7. ユーザーが全文や詳細を求めたとき、選択肢の良し悪しや帰結を見ないと答えられないとき、置き換えの関係を詳しく追うときは、該当する ADR の本文を読む。10件を超える ADR の本文を一度に読まない
8. ユーザーが今の決まりや今の実装を尋ねているときは、ADR に加えて今の文書と実装を読んで答える
   1. ADR から意思決定の背景・比べた選択肢・理由と、関係する論点を得る
   2. `AGENTS.md` の文書の案内から該当する文書を探し、その文書と関係するコード・設定を読む
   3. 今の文書・実装と ADR が食い違うときは今の文書・実装に従って答え、ADR の `status` か `partially_superseded_by` が古いかもしれないことを伝える
