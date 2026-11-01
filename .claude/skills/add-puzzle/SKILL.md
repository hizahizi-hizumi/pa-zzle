---
name: add-puzzle
description: >
  Orchestrates adding a new puzzle to pa-zzle end to end: an alignment with the human before starting,
  research, a stacked-PR implementation built stage by stage by the puzzle-stage-implementer agent,
  AI quality work without human involvement, and one final human review whose merge is the decision.
  This skill should be used when the user asks to "/add-puzzle", "add a new puzzle",
  "add a new game to pa-zzle", "implement a new puzzle end to end", "continue adding a puzzle",
  "apply final review feedback for a puzzle", "パズル追加", "新しいパズルを追加", "新しいゲームを作る",
  "<パズル名>の追加を本格的に進めて", "最終レビューの指摘を反映して", "直近のパズル追加と同じ進め方で".
argument-hint: "<パズル名> [最終レビューの指摘]"
---

# add-puzzle

`/add-puzzle <パズル名> [最終レビューの指摘]`

新しいパズルを、人間とのやり取り2回（着手時の認識合わせ・作り切った後の最終レビュー）だけで main へのマージまで運ぶ。最適化するのは、マージまでに人間がかける時間・往復回数・着手からマージまでの日数。

## 制約

- 人間に知らせるのは、認識合わせ・最終レビュー・「合意したパズルが成り立たない」の3つだけ。途中で連絡せず、未完成のものを判断させない。前提を変える必要が出たら、合意した意図の範囲で決めて進め、最終レビュー資料に書く。
- 認識合わせで得た許可の範囲を超えない。AI はマージしない。PR はオープンで段ごとに1本、base は前段。
- 作業中に `main` を取り込まない。`main` への rebase は、マージ前に `main` とコンフリクトしているときだけ1回行う。
- メインは計画・起動・確認・push・PR・人間への連絡を担い、調査・実装・レビューの本体はしない。サブエージェントは `model: opus`。この環境ではサブエージェントから入れ子で起動できないので、実装 → レビュー → 直しの繰り返しはメインが回す。
- 見ていないもの・確かめていないものを確認済みと書かない。計測・目視・推測を書き分ける。
- 正本（SPEC 等）に画面・演出・アルゴリズム・係数・理由・経緯・仮であることを書かない。コードとコミットに経緯や予定を書かない。
- PR 監視・定期確認・スケジュール実行を設定しない。
- この Skill の `TODO(人間判断)` は既定どおり進め、最終レビュー資料で未決として挙げる（`grep -rn 'TODO(人間判断)' .claude/skills/add-puzzle/`）。
- 手順と正本が食い違えば正本に従い、食い違いを最終レビュー資料に書く。

## 人間とのやり取り

1. **認識合わせ**（返事を待つのはここだけ）: 「これから作るもの」と、覆ると大きな作り直しになる前提を示し、合意と着手時の許可を得る。時間より中身の確かさを優先する。`references/alignment.md`
2. **最終レビュー**（人間の都合で見る。必要なら複数回）: 調査・実装・品質の作り込みを終えてから1回だけ知らせる。指摘を反映したら、また1回だけ知らせる。人間のマージが本決定。`references/final-review.md`

## 着手時の許可

認識合わせの返事でまとめて得る（既定で聞く）: `claude/<prefix>-*` への `push --force-with-lease`、候補ブランチの作成と削除、段の組み替え。

## 流れ

1. 認識合わせ → 合意（`references/alignment.md`）
2. 調査: 番号の予約、導入成立性、ルール変種の比較、実装前提調査（識別表・仮決定一覧・スタック計画）、調査 PR と段01 PR（`references/research.md`）
3. 実装: 段ごとに worktree を用意し、`puzzle-stage-implementer` に実装させ、確かめて push・PR（`references/implementation.md`）
4. 品質の作り込み: 機械検査、単純なプレイヤーのシミュレーション、プレイヤー目線の試遊（`puzzle-playtester`）、レビュー Agent 3種、失敗パターン集での自己点検、main との使い捨てマージでの verify（`references/ai-review.md`）
5. 最終レビュー資料を作って1回知らせる（`references/final-review.md`）
6. 指摘を反映（原因の段で直して `scripts/restack.sh` で積み直す）→ 4 → 5。マージは人間。

## 状態の置き場所とフェーズの判定

状態は GitHub と文書に置き、会話や `/tmp` に頼らない。brief・段カードは `/tmp/<game>-work/` に毎回作り直す。

| 状態 | 置き場所 |
|---|---|
| 認識合わせの合意・許可 | 導入調査 Issue の「## 認識合わせの合意（YYYY-MM-DD）」節。調査 PR 本文に写す |
| 識別表・仮決定一覧・スタック計画 | 段01の `<パズル名>実装前提調査.md` |
| 段の並び・検証・段で AI が決めたこと | 各段 PR 本文の Stack 表・Validation・「AI が決めたこと」 |
| 作り込みの結果 | 最上段 PR 本文の「## 品質の作り込み（N回目）」 |
| 最終レビュー資料と指摘・対応 | 最上段 PR 本文の「## 最終レビュー（N回目）」（資料の URL、知らせた日、指摘の原文、読み方、対応） |
| 候補ブランチ | 最上段 PR 本文の「候補」表 |

`git fetch --all --prune` の後、成果物を上から調べ、最初に欠けているところから再開する。名前は全ブランチの導入調査の文書（`git log --all --oneline -- 'docs/パズル/導入調査/<パズル名>/'`）の識別表から取り戻す。

| 調べるもの | 欠けているとき |
|---|---|
| 導入調査 Issue の合意節 | 認識合わせから |
| 調査 PR・段01 PR、4ゲートの判定、仮決定一覧とスタック表 | 調査から |
| スタック表の全段の PR と、各段の CI `quality-gate` の success | 実装（その段から） |
| 最新の段の変更より新しい「品質の作り込み」節で、critical / major が 0 | 品質の作り込み |
| 「最終レビュー（N回目）」節 | 資料を作って知らせる |
| 引数や会話に、未反映の最終レビューの指摘がある | 指摘の反映 |

すべてそろって指摘が無ければ、人間の返事を待つ状態なので何もしない。判定と根拠（見たブランチ・PR・文書）を1〜3行で示してから着手する。同じ接頭辞のブランチで、PR 本文の Stack 表にも「候補」表にも無いものは並行作業の形跡なので、触らずに最終レビュー資料に書く。

## GitHub の操作

GraphQL を使う `gh pr *` は 403 で失敗する。GitHub MCP ツール（ToolSearch で `mcp__github__*` をロード）を優先し、無ければ `gh api` の REST を使う。`/pr` Skill は使わない（`gh pr create` と自動 rebase を含むため）。

| 操作 | MCP | `gh api` |
|---|---|---|
| PR 作成（オープン） | `create_pull_request`（`draft: false`） | `gh api repos/{owner}/{repo}/pulls -f title=… -f head=<段> -f base=<前段> -F body=@<ファイル>` |
| PR を探す | `list_pull_requests`（`head: <owner>:<段>`, `state: all`） | `gh api 'repos/{owner}/{repo}/pulls?state=all&head={owner}:<段>'` |
| 本文の取得・更新 | `pull_request_read`（`get`）・`update_pull_request` | `gh api repos/{owner}/{repo}/pulls/<番号>`・`gh api -X PATCH … -F body=@<ファイル>` |
| CI の結果 | `pull_request_read`（`get_check_runs`） | `gh api 'repos/{owner}/{repo}/commits/<段>/check-runs?check_name=quality-gate'` |
| Issue 作成・更新 | `issue_write` | `gh api repos/{owner}/{repo}/issues -f title=… -F body=@<ファイル>` |
| プレビュー URL | ― | 下記（PR の無いブランチでも出る。版ごとの `Preview URL` とブランチの `Preview Alias URL`） |

```sh
gh api "repos/{owner}/{repo}/commits/<sha>/check-runs" \
  --jq '.check_runs[] | select(.name | startswith("Workers Builds")) | .output.summary'
```

PR 本文は「取得 → 書き換え → 更新」で直す。CI は段を完成させたときと積み直しの後に一度確かめるだけで、待ち続けない。

## いつどれを読むか

| ファイル | 読むとき |
|---|---|
| `references/alignment.md`・`assets/alignment.md` | 指示を受けて認識合わせを返す前 |
| `references/research.md`・`assets/research-issue.md` | 調査の間 |
| `references/implementation.md` | 段を始める前。段の並び・worktree と Agent の起動・画面確認・チェックリスト・PR 本文 |
| `references/ai-review.md` | 段のセルフレビュー（遊べる段は軽い試遊を含む）、品質の作り込み、直しと積み直し |
| `references/final-review.md`・`assets/review-sheet.md` | 資料を作るとき、指摘を受けたとき、マージの話が出たとき |
| `references/reporting.md` | 人間へ書く前に毎回 |
| `references/pitfalls.md` | 段カードを作るとき（該当する領域を渡す）、作り込みの自己点検 |
| `scripts/list-used-ids.sh` | 番号を予約するとき、文書レビューに使用中の番号を渡すとき |
| `scripts/capture-screens.mjs` | 画面の撮影とブラウザエラー・横スクロールの確認 |
| `scripts/restack.sh` | 原因の段を直した後の積み直し（既定は dry-run） |

正本: `AGENTS.md`、`CLAUDE.md`、`.claude/rules/`、`docs/README.md`、`APP.md`・`GAME.md`・`DESIGN.md`、`docs/プロダクト/仕様/`、`docs/パズル/README.md` から辿る難易度文書、`docs/棚上げ/README.md`、`docs/adr/index.csv`。委譲先: `.claude/agents/puzzle-stage-implementer.md`、`puzzle-playtester.md`、`puzzle-code-reviewer.md`・`puzzle-experience-reviewer.md`・`puzzle-document-reviewer.md`、`/design-game-pictogram`、`/adr-create`。
