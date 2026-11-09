# 作る順番

実装役はこの順で作る。順は依存で決まる。後の項目は、前の項目が作ったものの上でだけ完成を確かめられる。

- どの項目も、手本のゲームが同じ責務に持つ種類のテスト（Glob で手本と並べて比べる）をそろえるまでを完成条件に含める。
- いくつかの項目を続けて1つの作業カードにしてよい。片方を直すともう片方を必ず作り直す項目（difficulty と problem-pool など）は1つのカードにする。
- 失敗パターン集の「いつ」はこの項目名で書く。
- 作業ブランチでは、playable の時点でゲームを一覧に載せ、最初から全部の画面を通す。結果画面とゲームのホームはカタログからゲームを引くので、載せないとクリアした後の画面が開けない。後の項目は、playable が置いた最初の版を中身ごと作り込む。

表は新しく作るときの順。main への追従では `references/resume.md` の「main への追従の作業カード」に従う。

| 項目 | 作るもの・完成条件 | 完成時に開ける入口 | 一時的に置くもの | 作り方の Skill |
|---|---|---|---|---|
| research | `references/research.md` の「作るもの」 | — | — | — |
| rules | ルール・判定・状態とそのテスト（画面なし）。作る前に `.claude/rules/game-*.md` の「ゲームを追加するとき」を読み、依存規則の手順を通す | — | — | — |
| playable | `.claude/rules/game-*.md` の「ゲームを追加するとき」の全手順を、各責務の最初の版で通す。1問を最後まで遊べる盤面・操作・クリア判定、ゲームのホームとプレイの画面、遊び方・採点・記録・離脱・診断の最初の版、一覧への掲載と並び。カタログエントリの全項目はここで本物の関数としてつなぐ。完成条件は、一覧から開いて1問をクリアし、結果画面と記録が開けること | ゲームのホーム `/puzzles/<game>`、固定問題のプレイ画面 | 固定問題。各レベルに最低1問（全レベルに問題があることをカタログのテストが求める）。problem-pool で問題集に置き換わる | — |
| play-ui | `DESIGN.md`「色」と `.claude/rules/game-*.md` の「プレイ画面と結果画面の共通契約」を読んでから、ゲーム固有の背景を選び、補助操作（待った・盤面を戻すなど）、状態の知らせ、遊び方、クリア演出を作る。選んだ背景で通常時・状態の知らせ・クリア演出の途中を撮って確かめる | 同上 | — | — |
| sound | 盤面操作とクリアの効果音。書き出しのスクリプト `scripts/assets/<ゲーム ID>_sounds.ts` を作り、実装役が `bun` で動かす。音の定義を Chromium の `OfflineAudioContext` で描き、ffmpeg で `frontend/src/games/<game>/assets/sounds/` へ書き出す（書き出す前に `.claude/rules/game-*.md` の「効果音」を読み、形式を合わせる）。書き出しのスクリプトを書く前に、詰将棋の `scripts/assets/tsume_shogi_sounds.py`（ffmpeg の引数、PADDING の外し方、ピークの上限）と、この Skill の `scripts/playtest-driver.mjs`（playwright の読み込み方）を読む。録音を素材にするときも同じスクリプトで加工し、`frontend/src/games/tsume-shogi/assets/sounds/VCSL.CC0.txt` を読んで、同じ形で出典とライセンスを書き出し先に残す。直しで前の音の定義が残っていなければ、題材から作り直す。前の音に寄せるのは、人間が今の音を気に入っているときだけ。完成条件は、書き出したスクリプトに `bun x --cwd <worktree>/frontend biome check <スクリプトのパス>` が通ること（`scripts/assets/` は `scripts/verify.sh` の対象外） | 同上 | — | — |
| difficulty | 調査で決めた案の解法器・難易度の判定・生成器・`problem-selection.ts`、難易度の資料 | 同上 | — | `/design-game-difficulty` |
| problem-pool | 問題集と生成スクリプト。カタログエントリの問題集の全問・遊び直し先・問題の選び方を、固定問題から問題集に切り替える。完成条件は、調査で決めた件数と並びでそろい、`--verify`（生成とは別の手順で全問を確かめ直す。`/design-game-difficulty` の検査 A2）が通り、固定問題が残っていないこと | ゲームのホーム、問題 ID で開くレベルごとのプレイ画面 `/puzzles/<game>/play/<レベル>?problem=<問題ID>` | — | `/design-game-difficulty` |
| pictogram | ゲーム一覧のピクトグラム（`frontend/src/games/<game>/assets/pictogram.svg`）と、選んでいるときの色と動きのある姿（`frontend/src/games/<game>/assets/pictogram-showcase.svg`。白黒版を土台に作るので後に作る） | 同上 | — | `/design-game-pictogram`、続けて `/design-game-pictogram-showcase` |
| score | スコア（評価規則と基準時間） | 同上 | — | — |
| result-records | 結果画面・記録（`play-record.ts`）・`play-attempt.ts`・`diagnostics.ts`・記録からの遊び直し | 同上 | — | — |
| zukan | カタログエントリの問題の特徴（`describePoolProblem`・`problemFeatureFilter`）を、調査で決めた切り口で作る。完成条件は、ゲームのホームの図鑑で、クリアした問題に出来が付き、状態と問題の特徴で絞り込めること。成績の絞り込みは、ミスか手数を評価に使うパズルでは使えること、どちらも使わないパズルでは出ないこと（SPEC-026「絞り込み」） | 同上 | — | — |
| spec | 仕様（このパズルの決まりとその意図。書く前に `.claude/rules/documents.md` の「何を書くか」を読んで従う。難易度の節は難易度の資料の案から）、台帳の行（導入判断を正式採用にする。マージが決定。ほかの成立性は確かめた範囲の値にし、人が遊んで確かめるものは確認中のままにする）。ゲームをまたぐ判断が出たときだけ ADR にする（`docs/adr/README.md`） | — | — | ADR を作るときだけ `/adr-create` |

「完成時に開ける入口」は、試遊の入力の入口パスと、実装役の報告の「試遊の入口」が指すもの。
