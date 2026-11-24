# 作業カード 01: rules + playable（新規）

カタログの網羅テスト（`frontend/src/app/game-integration/game-catalog.test.ts`）は `src/games/` の全ゲームが一覧にあることを確かめるので、rules だけでは `verify.sh` が通らない。rules と playable を1つのカードにする。コミットは rules と playable で分けてよい（rules のコミットの時点で網羅テストが落ちるのは構わない。カードの終わりで `verify.sh` が通ること）。

## 項目と範囲・完成条件

`/home/user/pa-zzle/.claude/skills/add-puzzle/references/build-order.md` の rules と playable の行、実装前提調査 §5 の rules と playable の行。要点:

### rules

- `frontend/src/games/magic-square/puzzle/`: 盤面（n、最初から置いてある数、置いた数）、合計の定数 n(n²+1)/2、列（行 n・縦 n・斜め2）、置く・外す・置き換える（最初から置いてある数のマスは変えない。使った数は置けない）、候補のメモの状態（書く・消す、数を置いたらその数を全マスのメモから消す。メモの画面は play-ui で作るが、状態は rules で持つ）、列の今の合計と空きの数、列の状態（未完・一致・違反の2種: 埋まったのに合計と違う／空きがあるのに合計に届いた・超えた）、クリア判定（全マスが埋まり全列が一致）。
- 違反・一致の判定は今の盤面だけで決まり、答えと照合しない（D-05・D-06・D-07）。
- 依存規則を `bun run --cwd <worktree>/frontend generate:dependency-rules` で作り直す。
- 完成条件: 性質テスト（正解の配置で全列一致・クリア、ランダムな途中盤面で列の状態を素朴な判定器と突き合わせる、違反の2種と一致が今の盤面だけで決まる、最初から置いてある数を変えられない）。

### playable

- `.claude/rules/game-structure.md`「ゲームを追加するとき」の全手順を、各責務の最初の版で通す（`problem/problem.ts`・`session/`・`play/`・`ui/`・`display-name.ts`・`difficulty.ts`・`score.ts`・`problem-selection.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`、`app/game-integration/magic-square/`、`game-catalog.ts`・`game-guide.tsx`、`pages/puzzles/magic-square/` と View、一覧の並びのテスト）。カタログエントリの全項目は本物の関数でつなぐ。
- 固定問題: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/fixed-problems.json` の9問（各レベル1〜2問、4×4〜6×6）。problem-pool で問題集に置き換える。
- プレイ画面の最初の版は、仮決定どおりに作る: 列の端に今の合計（D-05。行は右、縦は下、斜め2本は左下と右下の角。合計の定数も盤面のそばに出す）、一致と違反の知らせ（D-06・D-07）、数の欄（D-08。1〜n² を位置固定で並べ、使った数を薄くして押せなくする）、入力（D-09。マスを選んでから数を押す。置いた数のマスを押すと選ぶだけ、同じ数をもう一度押すと外す、別の数で置き換える）。候補のメモ・待った・盤面を戻す・石の題材の地・クリア演出は play-ui で作り込むが、playable の時点で、置いた画面の要素を仮のまま残さない（失敗パターン「仮の表示が残る」）。
- 遊び方とチュートリアルは、`game-guide.tsx` が全ゲームに両方を求めるので最初の版を置く（作り込みは how-to-play + tutorial の項目で `/design-puzzle-how-to-play`・`/design-puzzle-tutorial` を使う）。
- 採点・記録は動作する初期版（最終的な計測事実と評価規則は score で決める。D-12 の「取り下げ」の事実を session が数えられるようにしておくと後が楽）。
- 完成条件: 一覧から開いて固定問題を iPhone 幅で最後まで解き、結果画面と記録が開ける。仮の「クリア」表示は置かない。5×5 と 6×6 の固定問題も iPhone 幅で開き、盤面と数の欄が一画面に収まるかを撮って報告する（D-04 の判断の材料。収まらなくても直すのは play-ui）。

## worktree とポート

- worktree: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work`
- 開発サーバーのポート: 5330
- driver のポート: iphone 9331、pc 9332。画像の出力先は作業ディレクトリの `shots/01/`

## 注意: 調査の資料を書いている最中

`docs/パズル/導入調査/魔方陣/`（調査コードを含む）は、調査役とメインが書いている最中で、未追跡のファイルがある。このディレクトリは読んでよいが、書き換えず、`git add` せず、`git status --short` が空かを確かめるときはこのディレクトリの未追跡・変更を除いてよい。コミットは `git -C <worktree> add <自分が作ったパス>` で、パスを指定して行う。

## この項目に効く失敗パターン

`/home/user/pa-zzle/.claude/skills/add-puzzle/references/pitfalls.md` のうち:

- 判定の誤りが下流に波及する（rules・play-ui）
- 根拠が1つ・推測を事実として言う（全項目）
- そろえる所と当てはめる所の取り違え（playable・play-ui・sound・作り込み）: アプリが持つもの（ヘッダー・結果・ゲームのホーム・待ったの強さ）は共通部品を使い、ゲームが持つもの（盤面・数の欄・知らせ）は題材から作る
- 仮の表示が残る（playable・play-ui）

## 出発点

新規（既存の実装は無い）。
