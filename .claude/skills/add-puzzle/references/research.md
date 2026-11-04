# 調査

認識合わせの合意をもとに、作業ブランチを作り、実装の前提を確かめて仮に決め、作る順番と PR の切り方を決める。ここで書いたものを、以後の実装・再開・レビューが読む。

## 作業ブランチ

1. 接頭辞は、`git ls-remote origin '<接頭辞>/*'` が空のものを選ぶ（既存のブランチを force-push で消さないため）。
2. main から作業ブランチと worktree を作る: `git worktree add <作業ディレクトリ>/work -b <接頭辞>/work origin/main`。
3. 作業ブランチを push して、push できることを実際に確かめる。

ブランチの削除を人間に頼まない。要らなくなったブランチは AI が消し、この環境で消せなければ黙って残す。確かめのためだけのブランチは作らない。

既存の実装を引き継ぐと合意したときも、作業ブランチは main から作り、既存の実装は取り込まない。作業カードの「出発点」に既存のブランチとパスを書き、実装役と作り方の Skill に読ませる。

## 作るもの

| もの | 置き場所 | 中身 |
|---|---|---|
| 導入調査 Issue | GitHub の Issue（題 `導入調査: <パズル名>`） | 合意節と、確かめごとの記録（SKILL.md の「記録」） |
| 実装前提調査 | `docs/パズル/導入調査/<パズル名>/<パズル名>実装前提調査.md` | 下の「実装前提調査の節」 |
| 調査コード | `scripts/research/<ゲーム ID>_<観点>.py` | seed を固定し、標準ライブラリだけで測る |
| 難易度の資料 | `docs/パズル/README.md` から辿る難易度文書の決まりに従う | 採用ゲートの根拠。難易度の観点の調査役が下書きする |
| 台帳の行 | `docs/棚上げ/パズル候補.csv` と `パズル候補/PUZZLE-nnn.md` | 導入判断と各成立性。対象パズルの行がすでにあれば、その行を更新する |

## 実装前提調査の節

上から順に置く。書き方は `docs/README.md` に従う。

1. 識別表: タイトルの直後に `| 項目 | 値 |` の2列で、パズル名・ゲーム ID・ブランチ接頭辞・候補 ID・SPEC 番号・導入調査 Issue 番号を1行ずつ（ほかのファイルが「識別表」と言うときはこの項目を指す）。SPEC 番号と候補 ID は、origin のどのブランチでも対象パズル以外に使われていないことを `git ls-tree` と `git grep` で確かめて予約する（台帳に対象パズルの行があれば、その ID を使う）。ADR の番号は `/adr-create` が決め、衝突は文書レビューで確かめる
2. 根拠の書き分け: 事実・計測（どのスクリプトで）・推測・AI判断（仮決定）
3. 認識合わせの合意
4. 成立性: 観点ごと
5. 仮決定一覧: 決めたこと、理由、比べた案、覆したときに作り直す範囲。作り込みの後に、この下へ「実装で確定した差分」（調査時の計画と違った点）を足す
6. 作る順番: 下の「作る順番」から、このパズルで使う項目と、その範囲・完成条件
7. PR の切り方: 下の「PR の切り方」から、このパズルの層と各層に入るパス
8. 確かめていないこと

## 調査役の分担

観点ごとに `puzzle-researcher` を1つ起動し、観点カードで観点と問いを渡す。調査役が書くのは、自分の観点の調査コードと作業ディレクトリの `<観点>.md`（難易度の観点では難易度の資料の下書きも）だけで、メインがそれを実装前提調査へまとめてコミットする。

| 観点 | 問い |
|---|---|
| 問題供給 | 想定の盤面の大きさごとに、一意解の問題を作れる割合と生成時間。必要な問題数をそろえる時間、問題集の大きさ |
| 難易度 | 挑戦の定義。難しさの源を全部当ててつまみの案を広げ、案ごとに上限・隣のレベルの分かれ方・素朴な解き方で押し切れる割合・数え方でレベルが変わる割合・収率を小さな生成で測って比べ、1つに決める。各レベルを利用者向けの一言で言えるか。手順は `/design-game-difficulty` の SKILL.md の入口「`/add-puzzle` の調査」 |
| スマホ操作 | スマホ縦画面の最小幅でのマスの大きさ（既存ゲームと比べる）、盤面と全操作が一画面に収まる盤面の上限、操作とスクロールの競合 |
| 導入判断 | 近い既存ゲーム・候補との違い、表示名（商標を避けた一般名）、台帳の各成立性の値 |

## 作る順番

実装役はこの順で作る。いくつかの項目を続けて1つの作業カードにしてよい。片方を直すともう片方を必ず作り直す項目（difficulty と problem-pool など）は1つのカードにする。失敗パターン集の「いつ」はこの項目名で書く。

| 項目 | 作るもの | 作り方の Skill |
|---|---|---|
| research | この文書の「作るもの」 | — |
| rules | ルール・判定・状態とそのテスト（画面なし）。依存規則を `generate:dependency-rules` で作り直し、カタログの一時的な除外（下）を足す | — |
| playable | 1問を最後まで遊べるプレイ画面（盤面・操作・クリア判定）、遊ぶためのルート（`pages/puzzles/<game>/` と View）、一覧に出さないカタログエントリ（`GameCatalogEntry` の全項目を、後の項目で作るものは仮の実装で埋める）。固定問題を開く入口パスを報告に書く | — |
| play-ui | 補助操作（待った・盤面を戻すなど）、状態の知らせ、遊び方、クリア演出 | — |
| sound | 盤面操作とクリアの効果音。鳴らす瞬間と強さは `DESIGN.md` の「効果音」、つなぎ方は `.claude/rules/game-structure.md` の「効果音」。音は題材から作って一度だけ書き出し、`assets/sounds/` に同梱する。書き出したスクリプトは `scripts/assets/<ゲーム ID>_sounds.py` に残し、worktree の絶対パスで `uv run` する（前例は `scripts/assets/tsume_shogi_sounds.py`） | — |
| difficulty | 調査で決めた案の解法器・難易度の判定・生成器・`problem-selection.ts`、難易度の資料 | `/design-game-difficulty` |
| problem-pool | 問題集と生成スクリプト。完成条件は、件数がそろい `--verify` で全問の再検証が通ること。問題 ID で開くレベルごとのプレイ画面のパスを報告に書く | `/design-game-difficulty` |
| pictogram | ゲーム一覧のピクトグラム | `/design-game-pictogram` |
| game-home | ゲームのホーム（`pages/puzzles/<game>/index.tsx` と `views/<Game>HomeView.tsx`）と、図鑑に渡す問題集の全問と問題の特徴（カタログエントリの `listPoolProblemIds`・`describePoolProblem`・`problemFeatureFilter`）。特徴は始めたときの盤面で分かるものだけにする（SPEC-026 の「問題の特徴」） | — |
| score | スコア（評価規則と基準時間） | — |
| result-records | 結果画面・記録（`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`）・記録からの遊び直し | — |
| catalog | 一覧への掲載と並び。カタログの一時的な除外を消す | — |
| spec | SPEC、ADR、台帳の行（導入判断を正式採用にする。マージが決定） | `/adr-create` |

カタログの一時的な除外: カタログの網羅テスト（`frontend/src/game-catalog/game-catalog.test.ts`）は `src/games/` の全ゲームが一覧にあることを確かめるので、一覧に載せる前は、このゲームを外す一時的な除外を置く（前例は `git log --all -S gamesNotInCatalogYet`）。作業ブランチでは rules で足して catalog で消し、PR では「ルールと問題」の層で足して「掲載」の層で消す。

## PR の切り方

作り込みを終えた作業ブランチの木を、依存の層で切る。各ファイルは、import する先がすべてその層以下にそろう最も下の層に入れる。ゲームの中は `.claude/rules/game-structure.md` の「依存方向」でほぼ下の表どおりになり、外れるもの（上の層の `score.ts` を import する問題集の生成スクリプト、共通のファイルなど）もこの決まりで層が決まる。こうすると下から順に各層が単体でビルドとテストを通る。小さいパズルでは隣の層をまとめてよく、決めた切り方は実装前提調査に書く。

| 層（ブランチ名の topic） | 入るもの |
|---|---|
| 調査（research） | `docs/パズル/導入調査/<パズル名>/`（実装前提調査は「実装で確定した差分」を含む最終版）、`scripts/research/<ゲーム ID>_*` |
| ルールと問題（rules-problem） | `frontend/src/games/<game>/` の `puzzle/`・`problem/`（生成と問題集）・`session/`・`difficulty.ts`・`problem-selection.ts`・`display-name.ts`、生成と分析のスクリプト（`frontend/scripts/*<game>*`）と `package.json` の scripts、`frontend/biome.json`（問題集の除外と依存規則） |
| プレイと画面（play-ui） | `play/`・`ui/`（遊び方を含む）・`assets/`（効果音を含む）・`scripts/assets/<ゲーム ID>_*`・`score.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts` |
| 掲載（catalog） | `frontend/src/game-catalog/<game>/` と `game-catalog.ts`、`frontend/src/pages/puzzles/<game>/` と View（ゲームのホーム・プレイ）、generouted が作り直す `frontend/src/router.ts`、一覧のテスト |
| 文書（docs） | SPEC・ADR・台帳の行と候補ファイル・各 README の一覧、最終レビューで足した正本と失敗パターン集への追記 |

切り出しの手順:

1. 最下層のブランチ `<接頭辞>/01-<topic>` を `git merge-base origin/main <接頭辞>/work` から作り、上の層を前の層の上に作る。各層は層ごとの worktree（`git worktree add <作業ディレクトリ>/layer-<NN> -b <ブランチ> <下の層>`）で作る。
2. 各層に、ゲーム固有のパスは作業ブランチの版で取り込み（`git checkout <接頭辞>/work -- <存在するパス>`）、共通のファイルは作業ブランチでの差分だけを当てて（`git diff <merge-base> <接頭辞>/work -- <パス> | git apply -3`）、main に並行で入った変更を消さないようにしてコミットする。
3. `git diff --stat <最上層> <接頭辞>/work` が空であることを確かめる。空でなければ、どの層にも入らなかったファイルを実装前提調査の「PR の切り方」に足して切り直す。
4. 積んだ PR では上の層と main の衝突が GitHub に出ないので、`git merge-tree --write-tree origin/main <最上層>` で衝突しないことを確かめる。衝突したら `final-review.md` の「コンフリクトと部分マージ」。
5. 全部を push して PR を積み、PR 本文は SKILL.md の「記録」の型で書く。層ごとの確かめは PR の CI（Quality Gate）に任せ、CI の完了は待たない。落ちたと分かったら作業ブランチで直して切り出し直す。
6. 最終レビュー資料に載せる Cloudflare のプレビュー URL（最上層の PR の Workers Builds の check run）だけは、出るまで待つ。待つ前に起きる手段（PR の購読か、数分後に戻る予約）を用意してから作業を終える。
