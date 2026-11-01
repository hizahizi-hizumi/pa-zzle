---
name: add-puzzle
description: >
  Orchestrates adding a new puzzle to pa-zzle from an alignment with the human, through research, a stacked-PR
  implementation and AI quality work, to one final human review whose merge is the decision.
  This skill should be used when the user asks to "/add-puzzle", "add a new puzzle", "add a new game to pa-zzle",
  "continue adding a puzzle", "apply final review feedback for a puzzle",
  "パズル追加", "新しいパズルを追加", "新しいゲームを作る", "パズルの追加を本格的に進めて",
  "最終レビューの指摘を反映して", "直近のパズル追加と同じ進め方で".
argument-hint: "<パズル名> [最終レビューの指摘]"
---

# add-puzzle

`/add-puzzle <パズル名> [最終レビューの指摘]`

新しいパズルを、人間とのやり取り2回（着手時の認識合わせ・作り切った後の最終レビュー）だけで main へのマージまで運ぶ。最適化するのは、マージまでに人間がかける時間・往復回数・着手からマージまでの日数。

## 制約

- 人間に知らせるのは、認識合わせ・最終レビュー・「合意したパズルが成り立たない」の3つだけ。途中で連絡せず、未完成のものを判断させない。前提を変える必要が出たら、合意した意図の範囲で決めて進め、最終レビュー資料に書く。
- 認識合わせで得た許可の範囲を超えない。AI はマージしない。PR はオープンで段ごとに1本、base は前段。
- 作業中に `main` を取り込まない。最終レビューを知らせる直前（初回と、指摘を反映した後の毎回）に `main` との衝突を確かめ、衝突しているときだけその場で `main` へ rebase し、各段を verify してから知らせる（`references/final-review.md`）。
- メインは計画・起動・確認・調査の統合とコミット・積み直しの衝突の解決・push・PR・人間への連絡を担い、調査・実装・レビューの本体はしない。サブエージェントは `model: opus`。この環境ではサブエージェントから入れ子で起動できないので、実装 → レビュー → 直しの繰り返しはメインが回す。
- Bash の前景は最長10分。長い処理（`restack.sh --execute`、再開できない生成）はメインが `run_in_background` で起動し、Monitor で終わりを待つ。
- 見ていないもの・確かめていないものを確認済みと書かない。計測・目視・推測を書き分ける。
- 正本（SPEC 等）に画面・演出・アルゴリズム・係数・理由・経緯・仮であることを書かない。コードとコミットに経緯や予定を書かない。
- PR 監視・定期確認・スケジュール実行を設定しない。
- この Skill の `TODO(人間判断)` は既定どおり進め、最終レビュー資料で未決として挙げる（`grep -rn 'TODO(人間判断)' .claude/skills/add-puzzle/`）。
- 手順と正本が食い違えば正本に従い、食い違いを最終レビュー資料に書く。

## 全体の流れ

1. 認識合わせ: 「これから作るもの」と覆ると大きな作り直しになる前提を示し、合意と着手時の許可を得る。返事を待つのはここだけ。
2. 調査（段00・段01）と実装（段02〜）: 段ごとに worktree を用意し、`puzzle-stage-implementer` に実装させ、確かめて push・PR を積む。
3. 品質の作り込み: 機械検査・単純なプレイヤー・試遊・レビュー Agent 3種で、critical / major を 0 にする。
4. 最終レビュー: 資料を作って1回だけ知らせる。指摘は原因の段で直して積み直し、3 からやり直す。マージは人間。

着手時の許可（認識合わせの返事でまとめて得る）: `claude/<prefix>-*` への `push --force-with-lease`、候補ブランチの作成と削除、段の組み替え。

## 状態の置き場所と再開の判定

状態は GitHub と文書に置き、会話や `/tmp` に頼らない。brief・段カードは `/tmp/<game>-work/` に毎回作り直す。

| 状態 | 置き場所 |
|---|---|
| 認識合わせの合意・許可 | 導入調査 Issue の「## 認識合わせの合意（YYYY-MM-DD）」節。調査 PR 本文に写す |
| 識別表・仮決定一覧・スタック計画 | 段01の `<パズル名>実装前提調査.md` |
| 段の並び・検証・段で AI が決めたこと | 各段 PR 本文の Stack 表・Validation・「AI が決めたこと」 |
| 作り込みの結果 | 最上段 PR 本文の「## 品質の作り込み（N回目）」 |
| 最終レビューの資料・指摘・人間の判断・対応 | 最上段 PR 本文の「## 最終レビュー（N回目）」と「## 人間の判断」 |
| 候補ブランチ | 最上段 PR 本文の「候補」表 |

`git fetch --all --prune` の後、上から調べ、最初に当てはまる行から再開する。名前は全ブランチの導入調査の文書（`git log --all --oneline -- 'docs/パズル/導入調査/<パズル名>/'`）の識別表から取り戻す。

| 調べるもの | 当てはまるとき |
|---|---|
| スタック表の全段の PR がマージ済み | 片づけだけして終える: 残った候補ブランチを `git push origin --delete` で消し、`git worktree list` に残る `/tmp/<game>-work/`・`/tmp/<game>-review/` の worktree を `git worktree remove` で消す |
| 導入調査 Issue の合意節が無い | 認識合わせから |
| 調査 PR・段01 PR、4ゲートの判定、仮決定一覧とスタック表のどれかが無い | 調査から |
| スタック表の段の PR が無いか、CI `quality-gate` が success でない | 実装（その段から） |
| 最新の段の変更より新しい「品質の作り込み」節が無いか、critical / major が残る | 品質の作り込み |
| 「最終レビュー（N回目）」節が無い | 資料を作って知らせる |
| 引数や会話に、未反映の最終レビューの指摘がある | 指摘の反映 |

どれにも当てはまらなければ人間の返事を待つ状態なので何もしない。判定と根拠（見たブランチ・PR・文書）を1〜3行で示してから着手する。

並行作業の形跡: 識別表の無い、同じパズル名の導入調査・同じゲーム ID の `frontend/src/games/<game>/`・同じ接頭辞のブランチで、PR 本文の Stack 表にも「候補」表にも無いもの。触らずに最終レビュー資料に書く。認識合わせの前に見つけたものは、引き継ぐか作り直すかを認識合わせで聞く（`references/alignment.md`）。

## GitHub の操作

GraphQL を使う `gh pr *` は 403 で失敗する。GitHub MCP ツールを優先し、無ければ `gh api` の REST を使う。`/pr` Skill は使わない。操作ごとの呼び方とプレビュー URL の取り方は `references/github.md`。

## いつどれを読むか

| ファイル | 読むとき |
|---|---|
| `references/alignment.md`・`assets/alignment.md` | 指示を受けて認識合わせを返す前 |
| `references/research.md`・`assets/research-issue.md` | 調査（段00・段01）の間 |
| `references/implementation.md` | 段を始める前。段の並び・worktree と Agent の起動・画面確認・チェックリスト・PR 本文 |
| `references/ai-review.md` | 段のセルフレビュー、品質の作り込み、直しと積み直し |
| `references/final-review.md`・`assets/review-sheet.md` | 資料を作るとき、指摘を受けたとき、main との衝突を確かめるとき |
| `references/reporting.md` | 人間へ書く前に毎回 |
| `references/github.md` | PR・Issue・CI・プレビュー URL を扱うとき |
| `references/pitfalls.md` | 段カードを作るとき（該当する領域を渡す）、作り込みの自己点検 |
| `scripts/list-used-ids.sh` | 番号を予約するとき、SPEC の段の直前、文書レビューに使用中の番号を渡すとき |
| `scripts/capture-screens.mjs` | 画面の撮影とブラウザエラー・横スクロールの確認 |
| `scripts/playtest-driver.mjs` | 試遊（`puzzle-playtester` が使う） |
| `scripts/restack.sh` | 原因の段を直した後の積み直し、`main` への rebase（既定は dry-run） |

## 参照する正本と委譲先

- 正本: `AGENTS.md`、`CLAUDE.md`、`.claude/rules/`、`docs/README.md`、`APP.md`・`GAME.md`・`DESIGN.md`、`docs/プロダクト/仕様/`、`docs/パズル/README.md` から辿る難易度文書、`docs/棚上げ/README.md`、`docs/adr/index.csv`
- 委譲先: `.claude/agents/puzzle-stage-implementer.md`（段の実装）、`puzzle-playtester.md`（試遊）、`puzzle-code-reviewer.md`・`puzzle-experience-reviewer.md`・`puzzle-document-reviewer.md`（レビュー）、`/design-game-pictogram`（ピクトグラム）、`/adr-create <タイトル>`（ADR）
