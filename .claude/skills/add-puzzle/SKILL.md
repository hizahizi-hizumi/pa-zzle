---
name: add-puzzle
description: >
  Orchestrates adding a new puzzle to pa-zzle through research, a stacked-PR implementation, AI review
  and human review, with three human gates, delegating research, implementation and review to Opus
  subagents. This skill should be used when the user asks to "/add-puzzle", "add a new puzzle",
  "add a new game to pa-zzle", "implement a new puzzle end to end", "continue adding a puzzle",
  "パズル追加", "新しいパズルを追加", "新しいゲームを作る", "<パズル名>の追加を本格的に進めて",
  "直近のパズル追加と同じ進め方で".
argument-hint: "<パズル名> [research|implement|ai-review|human-review]"
---

# add-puzzle

新しいパズルを pa-zzle へ追加する作業を、調査 → 実装 → AIレビュー → 人間レビューの4フェーズで進めるオーケストレーター。直近のパズル追加で実際にうまく回った進め方（リフレクション: main にマージ済み、詰将棋: `origin/claude/tsume-shogi-*` のスタック）を型にしている。

人間が判断するのは3つの関門（H0・H1・H2）と5つの人間レビュー領域だけにする。それ以外は規約と前例で AI が仮決定して進め、仮決定一覧に理由を残す。

## 起動

`/add-puzzle <パズル名> [research|implement|ai-review|human-review]`

- `<パズル名>`: 日本語の通称でよい（例: `氷の床迷路`）。
- フェーズ: 省略時は「フェーズの判定」で決める。指定された場合も、前のフェーズの終了条件を満たしていなければ、その旨を報告してから前のフェーズを続ける。

## 全体像

| フェーズ | 主な成果物 | 終わる条件 | 人間関門 |
|---|---|---|---|
| 1 調査 research | 紹介 Artifact、導入調査 Issue、`docs/パズル/導入調査/<パズル名>/`、`scripts/research/`、台帳更新、調査 PR、段01 PR | 4ゲートの判定と段01の仮決定一覧・スタック計画がそろい、H1 の結果が調査 PR 本文にある | **H0** ルールの核（導入成立性調査の前）／**H1** 本実装へ進むか（調査 PR と段01 PR を出した後） |
| 2 実装 implement | 段01のスタック表どおりの PR スタック | 全段の PR があり、各段の CI `quality-gate` が success、UI のある段の画面確認が済む | なし（仮決定で進める） |
| 3 AIレビュー ai-review | 観点別レビューの結果、各段への畳み込み、更新した仮決定一覧、最上段 PR の「AIレビュー」節 | `references/ai-review.md` の「人間へ渡す条件」 | なし |
| 4 人間レビュー human-review | レビュー資料（Artifact）、人間レビュー対応の記録、SPEC・台帳の確定 | 人間が正式採用を判断し、人間がマージする | **H2** 最終レビューと正式採用 |

関門と人間レビュー領域:

| 関門・領域 | 人間が決めること |
|---|---|
| H0 | ルールの核（基本ルール、クリア条件、解の扱い、推測を要する問題を出すか、盤面の幅、面白さの仮説） |
| H1 | 導入判断の結論、条件付き保留のまま本実装へ進むか、近縁ゲームと統合するか別ゲームにするか、スタックの段構成、表示名の仮名、スタックのブランチへの force-push の許可 |
| H2 | 人間レビュー領域の判断、表示名の確定と商標確認（J-PlatPat は人間が確かめる）の確認、main の共通契約へ追従するか、正式採用するか |
| 人間レビュー領域 | **ピクトグラム / 難易度プレビュー / ゲーム体験（見た目を含む）/ 難易度の体感 / スコアの納得感** の5つだけ。これ以外は人間に聞かない |

関門では止まって人間の判断を待つ。関門以外では止まらない。残作業を抱えたまま報告して止まらず、次の関門か人間レビューに出せる状態まで進めてから知らせる。

TODO(人間判断): H0 を必須にするか（ルールの核だけ先に合意する方式が最も手戻りが小さかった）。既定: 必須。

## 名前と識別子

| 名前 | 例 | 使う場所 |
|---|---|---|
| パズル名 | `ハミルトン路` | 導入調査ディレクトリ `docs/パズル/導入調査/<パズル名>/`、文書名 |
| ゲーム ID `<game>` | `hamiltonian-path` | ASCII のケバブケース。`frontend/src/games/<game>/`、URL、記録の `gameId` |
| ブランチ接頭辞 `<prefix>` | `hamiltonian` | `claude/<prefix>-NN-<topic>`。ゲーム ID と同じでも短くしてもよい |
| 候補 ID | `PUZZLE-056` | 台帳 `docs/棚上げ/パズル候補.csv` |
| SPEC 番号 | `SPEC-0NN` | SPEC を作る段で採番する。それまでは「未採番」 |

- この5つは段01の実装前提調査の冒頭に「識別表」として必ず置き、採番したら更新する。再開時の判定はこの表から名前を取り戻す。
- ブランチ: 調査 PR は `claude/<prefix>-00-feasibility`（base `main`）。段01は `claude/<prefix>-01-research`（base は調査 PR のブランチ）。以後は前段を base にして積む。最上段は段01のスタック表の最後の段で、名前を固定しない。

## フェーズの判定

`git fetch --all --prune` の後、まず名前を取り戻す。

1. 導入調査の文書を全ブランチから探す: `git log --all --oneline -- 'docs/パズル/導入調査/<パズル名>/'`。
2. 見つかったブランチの段01の識別表から、ゲーム ID・ブランチ接頭辞・候補 ID を取る（`git show <ブランチ>:docs/パズル/導入調査/<パズル名>/<パズル名>実装前提調査.md`）。
3. PR は `claude/<prefix>-` の各ブランチについて GitHub から取る（「GitHub の操作」）。

次を上から順に調べ、最初に当てはまったものを現在地とする。

| 調べるもの | 状態 | 現在地 |
|---|---|---|
| 導入調査の文書・導入調査 Issue | 文書も Issue も無い。または Issue に「人間決定（H0, YYYY-MM-DD）:」の行が無い | research（候補の確認・H0 から） |
| 調査 PR `claude/<prefix>-00-feasibility` と段01 PR | どちらかが無い、または導入成立性調査に4ゲートの判定が無い | research（導入成立性調査・段01から） |
| 調査 PR 本文 | 見出し「## 人間決定（H1, YYYY-MM-DD）」が無い | research（H1 の報告から） |
| 段01のスタック表と各段の PR・CI | PR が無い段がある、または段の先端の CI `quality-gate` が success でない段がある | implement（その段から） |
| 最上段 PR 本文 | 「## AIレビュー」節が無い、または critical / major が残っている | ai-review |
| 最上段 PR 本文 | 上がすべて済んでいる | human-review |

- H0 の記録は、調査 PR ができる前は導入調査 Issue 本文の「人間決定（H0, YYYY-MM-DD）:」の行、できた後は調査 PR 本文の見出し「## 人間決定（H0, YYYY-MM-DD）」で判定する。H1 の結論が `見送り` なら、そこで終える。
- verify の状態は各段の CI check-runs（`quality-gate`）で判定する。判定のために全段でローカルの `./scripts/verify.sh` を回さない。
- 判定結果と根拠（見たブランチ・PR・文書）を1〜3行で報告してから着手する。
- 並行作業の形跡: 同じ接頭辞のブランチで、自分たちの PR 本文の Stack 表に無いものがあれば、着手前に人間へ知らせる。それ以外では止まらない。

## 状態の置き場所

再開に必要な状態は、次の場所だけに置く。会話や `/tmp` に頼らない。

| 状態 | 置き場所 |
|---|---|
| 人間決定（H0・H1・H2） | 調査 PR 本文の「## 人間決定（Hn, YYYY-MM-DD）」節。H2 は最上段 PR 本文にも書く |
| 段の並び・各段の PR | 各段 PR 本文の「## Stack」表（全段の段・ブランチ・PR 番号・状態） |
| 検証結果 | 各段 PR 本文の「## Validation」節と CI check-runs |
| AIレビューの結果 | 最上段 PR 本文の「## AIレビュー」節 |
| 人間レビューの指摘と対応 | 最上段 PR 本文の「## 人間レビュー対応（N回目）」節 |
| 仮決定と人間判断での取り下げ・確定 | 段01の実装前提調査の仮決定一覧 |

brief（全段共通の指示）と handoff（段ごとの指示）は `/tmp/<game>-work/` に置く一時ファイルで、上の場所から毎回作り直す。消えても困らないようにする。

## 役割分担

- **メインエージェント**: 計画、サブエージェントへの指示、検証、統合、コミット、push、PR の作成と本文の更新、人間への報告を担う。調査・実装・レビューの本体は自分でやらない。
- **サブエージェント**: 調査・実装・修正を担う。Agent ツールで起動し、`model` は必ず `opus` にする。
  - コミットしない。作業ツリーに変更を残し、変更したファイルと検証結果を報告させる。コミットはメインが差分を確かめてから行う。
  - 担当外のファイル・ブランチを触らない。試作は `/tmp` に置く。
  - 人間未承認の判断を確定事項として正本へ書かない。仮決定は「AI判断（仮決定）」と明記させる。
- **レビュー役**: サブエージェントはサブエージェントを起動できないので、レビューはメインが別のサブエージェントとして立てる。経緯を知らない新しいサブエージェントにし、作業を担当したサブエージェントに自分の成果をレビューさせない。
- 指示には「何を手本にするか」を具体的に書く。手本の渡し方は `references/implementation.md` の「手本の渡し方」に従う。

## 動作フロー

1. **現状把握**: 引数とフェーズの判定で現在地を決める。`AGENTS.md`・`docs/README.md`・該当フェーズの reference を読む。
2. **計画を立てる**: そのフェーズで作る成果物、サブエージェントの分け方（並行できるもの・順に進めるもの）、手本を決める。関門以外では人間に計画の承認を求めない。
3. **委譲する**: brief・handoff を作り直し、手本とともに Opus サブエージェントへ渡す。調査は観点別に 2〜4 本並行、実装は段ごとに順に進める。
4. **検証する**: サブエージェントの報告だけで「確認済み」としない。メインが差分を読み、段の先端で `./scripts/verify.sh` を走らせ、画面のある変更はスクショを自分の目で見る。
5. **統合する**: コミット（`/commit`）、push、PR 作成（下の「GitHub の操作」）を行う。PR 本文の Stack 表・Validation と仮決定一覧を更新する。
6. **報告する**: 関門に来たとき、またはフェーズを終えたときに、`references/reporting.md` に従って人間へ知らせる。

## GitHub の操作

クラウド環境では `gh pr list` / `gh pr create` / `gh pr view` / `gh pr checks` など GraphQL を使う `gh` のサブコマンドが 403 で失敗する。次の順で使う。

1. GitHub MCP ツール（ToolSearch で `select:mcp__github__create_pull_request,mcp__github__pull_request_read,mcp__github__update_pull_request,mcp__github__list_pull_requests,mcp__github__add_issue_comment` をロードする）
2. MCP ツールが無い環境では `gh api` の REST（`{owner}/{repo}` は gh がリモートから埋める）

| 操作 | MCP ツール | `gh api` |
|---|---|---|
| PR 作成（オープン） | `create_pull_request`（`draft: false`） | `gh api repos/{owner}/{repo}/pulls -f title=<題> -f head=<ブランチ> -f base=<前段> -F body=@<本文ファイル>` |
| ブランチの PR を探す | `list_pull_requests`（`head: <owner>:<ブランチ>`, `state: all`） | `gh api 'repos/{owner}/{repo}/pulls?state=all&head={owner}:<ブランチ>'` |
| 本文の取得・更新 | `pull_request_read`（`get`）・`update_pull_request`（`body`） | `gh api repos/{owner}/{repo}/pulls/<番号>`・`gh api -X PATCH repos/{owner}/{repo}/pulls/<番号> -F body=@<本文ファイル>` |
| CI の結果 | `pull_request_read`（`get_check_runs`） | `gh api 'repos/{owner}/{repo}/commits/<ブランチ>/check-runs?check_name=quality-gate'` |
| コメント（Preview URL） | `pull_request_read`（`get_comments`） | `gh api repos/{owner}/{repo}/issues/<番号>/comments` |
| Issue 作成 | `issue_write` | `gh api repos/{owner}/{repo}/issues -f title=<題> -F body=@<本文ファイル>` |

- `/pr` Skill は呼ばない（`gh pr create` と、作成後の自動 rebase を含むため）。PR 本文の型は `/pr` の `references/pr.md`（What / Why / Validation / Impact・Risk）を手本にし、`references/implementation.md` の「PR 本文」の節を加える。
- Preview URL は Cloudflare の bot コメントの「Branch Preview URL」から取る。
- 段を完成させたときと全体レビューの後に CI の結果を一度確かめるのは、PR の監視ではない。待ち続けたり、定期確認を設定したりしない。

## いつどの reference・script を使うか

| ファイル | 使うとき |
|---|---|
| `references/research.md` | research フェーズ全体。候補の確認、紹介 Artifact、H0、導入成立性調査（4ゲート）、段01、調査 PR・段01 PR、H1 |
| `references/implementation.md` | implement フェーズ全体。段の並びと完成条件、手本の渡し方、brief・handoff、画面確認、触る場所チェックリスト、採番、PR 本文 |
| `references/ai-review.md` | ai-review フェーズ全体。段ごとのセルフレビューを行うときは implement 中にも読む。各段への畳み込みの手順 |
| `references/human-review.md` | human-review フェーズ全体。人間から指摘を受けたとき、正式採用・マージの話が出たとき |
| `references/reporting.md` | 人間へ報告・質問・提案を書く前に毎回 |
| `assets/research-issue.md` | 導入調査 Issue を起票するとき |
| `assets/review-sheet.md` | 最終人間レビュー資料（Artifact）を作るとき |
| `scripts/list-used-ids.sh` | 候補 ID・SPEC 番号を採番するとき、文書レビューに使用中の番号を渡すとき |
| `scripts/capture-screens.mjs` | 画面確認と、レビュー用のスクショ・ブラウザ確認結果を撮るとき |

## 参照する正本

フェーズの reference が指定するものに加え、次を正とする。食い違えば正本を正とし、この Skill を直す提案を報告に含める。

- 作業の決まり: `AGENTS.md`、`CLAUDE.md`、`.claude/rules/`（特に `game-structure.md`、`vitest.md`、`views.md`、`pages.md`、`typescript*.md`、`react-hooks.md`、`component-styling.md`、`self-documenting-code.md`）
- 文書の置き場所と書く基準: `docs/README.md`、`docs/プロダクト/README.md`、`docs/プロダクト/仕様/README.md`、`docs/プロダクト/仕様/パズル/README.md`
- 体験と見た目: `APP.md`、`GAME.md`、`DESIGN.md`（値は `frontend/styles/globals.css` の `@theme`）
- ゲーム共通仕様: `docs/プロダクト/仕様/ゲーム/`（SPEC-003〜007、014、016、017）と `docs/プロダクト/仕様/アプリ/`
- 難易度: `docs/パズル/README.md` から辿る難易度文書。特に `docs/パズル/難易度開発手順.md` の採用ゲート・完了ゲート
- 台帳: `docs/棚上げ/README.md`、`docs/棚上げ/パズル候補.csv`
- 判断の理由: `docs/adr/index.csv`（`/adr-reference`）
- PR 本文の型: `.claude/skills/pr/references/pr.md`
- 委譲先の Skill: `/design-game-pictogram`（ピクトグラム）、`/adr-create`（理由の記録）、`/commit`（通常のコミット）
- レビュー Agent: `.claude/agents/puzzle-code-reviewer.md`、`puzzle-experience-reviewer.md`、`puzzle-document-reviewer.md`

## 出力先

| 成果物 | 置き場所 |
|---|---|
| 紹介 HTML・最終レビュー資料 | claude.ai Artifact。リポジトリに入れない |
| 操作試作・調査中のスクショ・brief・handoff・レビュー入力 | `/tmp/<game>-work/`・`/tmp/<game>-review/`。人間にパスを渡さない |
| 実験コード | `scripts/research/<game_snake>_*.py`（ゲーム ID のハイフンをアンダースコアにする。seed 固定、標準ライブラリ、`selfcheck` 付き） |
| 導入調査・実装前提調査・難易度・成績評価・ピクトグラム検討 | `docs/パズル/導入調査/<パズル名>/`（資料） |
| パズル仕様 | `docs/プロダクト/仕様/パズル/SPEC-0NN.md`（正本、SPEC の段で作る） |
| 台帳 | `docs/棚上げ/パズル候補.csv`、`docs/棚上げ/パズル候補/PUZZLE-NNN.md`（索引のみ） |
| 実装 | `frontend/src/games/<game>/` ほか（`references/implementation.md` のチェックリスト） |
| 判断の理由 | `docs/adr/`（`/adr-create`、必要なときだけ） |
| 再開に必要な状態 | 上の「状態の置き場所」 |

## 制約

- 作業中に `main` を取り込まない。merge commit で `main` に追従しない。
- `main` への rebase は1回だけ: H2 の後に人間がマージすると言った時点で `main` とコンフリクトしている場合に限り、人間の許可を得て全段をまとめて rebase し、`--force-with-lease` で push する（`references/human-review.md`「マージ」）。
- AIレビュー・人間レビュー対応での各段への畳み込み（autosquash）は `main` を取り込まないので、上の rebase とは別に扱う。その force-push の許可は H1 で「スタックのブランチへの force-push」としてまとめて得る。許可の範囲（どのブランチか）を超えない。
- AI はマージしない。マージは人間が下の段から merge commit で行う。
- PR はドラフトにしない。段ごとに1 PR、base は前段のブランチにする。
- PR 監視・定期確認・スケジュール実行を提案・設定しない。
- push は区切り（段の完成、レビュー対応の完了）ごとに行い、試行錯誤ごとに push しない。
- 仮決定は必ず仮決定一覧（段01の実装前提調査）に、理由・比べた案・最終レビューで判断してほしい点とともに残す。人間判断で覆ったら「人間判断で取り下げ」、人間が認めたら「人間判断で確定」と記録する。
- 確定した案・人間が選んだ案を勝手に変えない。
- 人間に聞くのは関門と人間レビュー領域だけ。ゲームの性格を変える判断（推測を要する問題を出すか等）は H0 に、近縁ゲームとの統合は H1 に含めて先に聞く。
- 台帳の導入判断を `正式採用` へ上げるのは H2 で人間が判断したときだけ。資料（導入調査・台帳）を削除しない。
- コードとコミットに試行錯誤のコメントや経緯（「〜の段で載せる」等の予定を含む）を残さない。
- 正本（SPEC 等）に画面・演出・アルゴリズム・調整係数・理由・経緯・仮であることを書かない。
- この Skill の手順と正本が食い違ったら正本に従い、食い違いを報告する。
- この Skill と references の `TODO(人間判断)` は、書かれた既定どおりに進め、作業中に人間へ聞かない。最後の報告で、従った既定とともに未決として挙げる（`grep -rn 'TODO(人間判断)' .claude/skills/add-puzzle/` で集める）。
