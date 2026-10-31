---
name: add-puzzle
description: >
  This skill should be used when the user asks to "/add-puzzle", "add a new puzzle", "add a new game",
  "new game", "implement a new puzzle end to end", "continue adding a puzzle", "パズル追加",
  "新しいパズルを追加", "新しいゲームを作る", "〜を本格的に進めて", "直近のパズル追加と同じ進め方で".
  Orchestrates adding a puzzle to pa-zzle through research, a stacked-PR implementation, AI review and
  human review, with three human gates, delegating research, implementation and review to Opus subagents.
argument-hint: "<パズル名> [research|implement|ai-review|human-review]"
---

# add-puzzle

新しいパズルを pa-zzle へ追加する作業を、調査 → 実装 → AIレビュー → 人間レビューの4フェーズで進めるオーケストレーター。直近のパズル追加（リフレクション、詰将棋、ハミルトン路）で実際にうまく回った進め方を型にしている。

人間が判断するのは3つの関門（H0・H1・H2）と人間レビュー領域だけにする。それ以外は規約と前例で AI が仮決定して進め、仮決定一覧に理由を残す。

## 起動

`/add-puzzle <パズル名> [research|implement|ai-review|human-review]`

- `<パズル名>`: 日本語の通称でよい（例: `氷の床迷路`）。ゲーム ID（ASCII のケバブケース、例: `ice-floor-maze`）は調査フェーズで決め、以後はブランチ名・ディレクトリ名に使う。
- フェーズ: 省略時は次の「フェーズの判定」で決める。指定された場合も、前のフェーズの終了条件を満たしていなければ、その旨を報告してから前のフェーズを続ける。

### フェーズの判定

`git fetch --all --prune` の後、次を上から順に調べ、最初に当てはまったフェーズを現在のフェーズとする。

| 調べるもの | 状態 | 現在のフェーズ |
|---|---|---|
| `docs/棚上げ/パズル候補.csv`・`docs/パズル/導入調査/<パズル名>/`・`git branch -r` | 導入調査の文書が無い、または導入成立性調査の結論（4ゲートの判定）が無い | research（H0 か導入成立性調査から） |
| 同上と `gh pr list --state all --search "<パズル名>"` | 結論はあるが H1 の記録（本実装へ進む判断）が無い | research（H1 から） |
| `git branch -r \| grep "claude/<game>-"` | 段01〜最終段（SPEC）のいずれかが無い、または verify が通っていない段がある | implement |
| 最上段 PR 本文の「AIレビュー」節 | 全段そろっているが、全体のAIレビュー記録が無い、または critical/major が残る | ai-review |
| 最上段 PR 本文の「人間レビュー対応」節・レビュー資料 | AIレビューが完了している | human-review |

判定結果と根拠（見たブランチ・PR・文書）を1〜3行で報告してから着手する。並行して別のセッションが同じパズルを進めている形跡（知らないブランチ・未マージのコミット）があれば、着手前に人間へ知らせる。

## 全体像

| フェーズ | 主な成果物 | 終わる条件 | 人間関門 |
|---|---|---|---|
| 1 調査 research | 紹介 Artifact、導入調査 Issue、`docs/パズル/導入調査/<パズル名>/`、`scripts/research/`、台帳更新、調査 PR、段01（実装前提調査） | 4ゲートの判定と段01の仮決定一覧・スタック計画がそろう | **H0** ルールの核の合意（調査の前）／**H1** 本実装へ進むか（調査の後） |
| 2 実装 implement | `claude/<game>-NN-<topic>` の PR スタック（標準11段） | 全段が `./scripts/verify.sh` を通り、UI のある段の画面確認が済む | なし（仮決定で進める） |
| 3 AIレビュー ai-review | 観点別レビューの結果、各段への畳み込み、更新した仮決定一覧 | critical/major 0、全段 verify PASS、CI green、レビュー資料完成 | なし |
| 4 人間レビュー human-review | レビュー資料（Artifact）、人間レビュー対応の記録、SPEC・台帳の確定 | 人間が正式採用を判断し、人間がマージする | **H2** 最終レビューと正式採用 |

関門では止まって人間の判断を待つ。関門以外では止まらない。残作業を抱えたまま報告して止まらず、次の関門か人間レビューに出せる状態まで進めてから知らせる。

TODO(人間判断): H0 を必須にするか（氷の床迷路のように、ルールの核だけ先に合意する方式が最も手戻りが小さかった）。叩き台では必須にしている。

## 役割分担

- **メインエージェント**: 計画、サブエージェントへの指示、検証、統合、コミット、push、PR 作成、人間への報告を担う。調査・実装・レビューの本体は自分でやらない。
- **サブエージェント**: 調査・実装・修正を担う。Agent ツールで起動し、`model` は必ず `opus` にする。
  - コミットしない。作業ツリーに変更を残し、変更したファイルと検証結果を報告させる。コミットはメインが差分を確かめてから行う。
  - 担当外のファイル・ブランチを触らない。試作は `/tmp` に置く。
  - 人間未承認の判断を確定事項として正本へ書かない。仮決定は「AI判断（仮決定）」と明記させる。
- **レビュー役**: サブエージェントはサブエージェントを起動できないので、レビューはメインが別のサブエージェントとして立てる。経緯を知らない新しいサブエージェントにし、作業を担当したサブエージェントに自分の成果をレビューさせない。
- 指示には「何を手本にするか」を具体的に書く。手本の渡し方は `references/implementation.md` の「手本の渡し方」に従う。
- 段をまたぐ共通の決まりは scratchpad の brief（bun の PATH、`bun.lock` を触らない、コミットしない、経緯をコードに残さない 等）に、段ごとの指示は handoff ファイルに書き、サブエージェントには最初にそれを読ませる。コンテナの再起動で中断しても handoff から後任が続けられるようにする。

## 動作フロー

1. **現状把握**: 引数とフェーズの判定で現在地を決める。`AGENTS.md`・`docs/README.md`・該当フェーズの reference を読む。
2. **フェーズの reference を読む**: 下の「いつどの reference を読むか」に従う。
3. **計画を立てる**: そのフェーズで作る成果物、サブエージェントの分け方（並行できるもの・順に進めるもの）、手本を決める。関門以外では人間に計画の承認を求めない。
4. **委譲する**: Opus サブエージェントへ brief・handoff・手本を渡して作業させる。調査は観点別に 2〜4 本並行、実装は段ごとに順に進める。
5. **検証する**: サブエージェントの報告だけで「確認済み」としない。メインが差分を読み、`./scripts/verify.sh` を走らせ、画面のある変更はスクショを自分の目で見る。
6. **統合する**: コミット（`/commit`）、push、PR 作成（`/pr`、base は前段）を行う。仮決定一覧と PR 本文を更新する。
7. **報告する**: 関門に来たとき、またはフェーズを終えたときに、`references/reporting.md` に従って人間へ知らせる。

## いつどの reference を読むか

| ファイル | 読むとき |
|---|---|
| `references/research.md` | research フェーズ全体。候補の確認、紹介 Artifact、H0、導入成立性調査（4ゲート）、段01（実装前提調査）、H1、台帳更新 |
| `references/implementation.md` | implement フェーズ全体。段の並びと完成条件、手本の渡し方、触る場所チェックリスト、画面確認の手順、採番、PR 本文の型 |
| `references/ai-review.md` | ai-review フェーズ全体。段ごとのセルフレビューの手順を確かめるときは implement 中にも読む |
| `references/human-review.md` | human-review フェーズ全体。人間から指摘を受けたとき、正式採用・マージの話が出たとき |
| `references/reporting.md` | 人間へ報告・質問・提案を書く前に毎回 |
| `assets/research-issue.md` | 導入調査 Issue を起票するとき |
| `assets/review-sheet.md` | 最終人間レビュー資料（Artifact）を作るとき |

## 参照する正本

フェーズの reference が指定するものに加え、次を正とする。食い違えば正本を正とし、この Skill を直す提案を報告に含める。

- 作業の決まり: `AGENTS.md`、`CLAUDE.md`、`.claude/rules/`（特に `game-structure.md`、`vitest.md`、`views.md`、`pages.md`、`typescript*.md`、`react-hooks.md`、`component-styling.md`、`self-documenting-code.md`）
- 文書の置き場所と書く基準: `docs/README.md`、`docs/プロダクト/README.md`、`docs/プロダクト/仕様/README.md`、`docs/プロダクト/仕様/パズル/README.md`
- 体験と見た目: `APP.md`、`GAME.md`、`DESIGN.md`（値は `frontend/styles/globals.css` の `@theme`）
- ゲーム共通仕様: `docs/プロダクト/仕様/ゲーム/`（SPEC-003〜007、014、016、017）と `docs/プロダクト/仕様/アプリ/`
- 難易度: `docs/パズル/README.md` から辿る難易度文書。特に `docs/パズル/難易度開発手順.md` の採用ゲート・完了ゲート
- 台帳: `docs/棚上げ/README.md`、`docs/棚上げ/パズル候補.csv`
- 判断の理由: `docs/adr/index.csv`（`/adr-reference`）
- Git 運用: `.claude/skills/pr/SKILL.md`、`.claude/skills/commit/SKILL.md`
- 委譲先の Skill: `/design-game-pictogram`（ピクトグラム）、`/adr-create`（理由の記録）、`/commit`・`/pr`（コミットと PR）

## 出力先

| 成果物 | 置き場所 |
|---|---|
| 紹介 HTML・最終レビュー資料 | claude.ai Artifact。リポジトリに入れない |
| 操作試作・調査中のスクショ・brief・handoff | `/tmp` または scratchpad。人間にパスを渡さない |
| 実験コード | `scripts/research/<game>_*.py`（seed 固定、標準ライブラリ、`selfcheck` 付き） |
| 導入調査・実装前提調査・難易度・成績評価・ピクトグラム検討 | `docs/パズル/導入調査/<パズル名>/`（資料） |
| パズル仕様 | `docs/プロダクト/仕様/パズル/SPEC-0NN.md`（正本、最終段で作る） |
| 台帳 | `docs/棚上げ/パズル候補.csv`、`docs/棚上げ/パズル候補/PUZZLE-NNN.md`（索引のみ） |
| 実装 | `frontend/src/games/<game>/` ほか（`references/implementation.md` のチェックリスト） |
| 判断の理由 | `docs/adr/`（`/adr-create`、必要なときだけ） |
| 人間レビューの記録 | 最上段 PR 本文の「人間レビュー対応（N回目）」節 |

## 制約

- 作業中に `main` を取り込まない。PR が `main` とコンフリクトしたときだけ最新 `main` へ rebase する。merge commit で `main` に追従しない。
- force-push は人間の許可を得てから `--force-with-lease` で行う。許可の範囲（どのブランチか）を超えない。
- AI はマージしない。マージは人間が下の段から merge commit で行う。
- PR はドラフトにしない。段ごとに1 PR、base は前段のブランチにする。
- PR 監視・定期確認・スケジュール実行を提案・設定しない。
- push は区切り（段の完成、レビュー対応の完了）ごとに行い、試行錯誤ごとに push しない。
- 仮決定は必ず仮決定一覧（段01の実装前提調査）に、理由・比べた案・最終レビューで判断してほしい点とともに残す。人間判断で覆ったら「人間判断で取り下げ」と記録する。
- 確定した案・人間が選んだ案を勝手に変えない。
- 人間に聞くのは関門と人間レビュー領域だけ。設計上の重要判断（例: 推測を要する問題を出すか）は H0 に含めて先に聞く。
- 台帳の導入判断を `正式採用` へ上げるのは H2 で人間が判断したときだけ。資料（導入調査・台帳）を削除しない。
- コードとコミットに試行錯誤のコメントや経緯を残さない。
- 正本（SPEC 等）に画面・演出・アルゴリズム・調整係数・理由・経緯を書かない。
- この Skill の手順と正本が食い違ったら正本に従い、食い違いを報告する。
