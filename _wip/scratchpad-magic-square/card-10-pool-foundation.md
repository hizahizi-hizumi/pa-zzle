# 作業カード 10: 問題集の土台（難易度の版に依らない所）

実装前提調査 §5 の「difficulty + problem-pool」のうち、難易度の判定（読むモデル・分類・与える数の減らし方と磨き方）に依らない所を先に作る。難易度の判定は、調査で反例探し（A4）の4回目に反例が出て、調査役が版 6 に直している。版 6 が決まったら、読むモデル・分類・生成・問題集・`--verify` を、このカードの土台の上で次のカード（`/design-game-difficulty` を入口「新規」で起動する）で作る。このカードでは `/design-game-difficulty` を起動しない。

## 作るもの

置き場所は手本（アイスフロア迷路 `frontend/src/games/ice-floor-maze/problem/` と `problem/generation/`）に合わせ、`frontend/src/games/magic-square/problem/` の下に置く。

1. 完全な解法器: 与える数から解を数える（2解で止める、節点の上限で打ち切る）。調査コード `magic_square_difficulty.py` の `Geometry`・`geo_of`・`line_allowed_masks`・`count_solutions` を移す。6×6 の数の集合は 37 ビット要り、JavaScript のビット演算（32 ビット）にそのまま乗らないので、表し方を決める（供給実験の結論）。
2. 答えの魔方陣: 4×4 は全 7,040 通り（`all_squares4`）から一様に選ぶ（D-14）。5×5・6×6 は乱択の探索（`random_magic_square`）。乱数は製品の `ProblemRandom` から受ける（Python の乱数とは一致しなくてよい）。
3. 同型と近さ（`magic_square_supply.py` の `line_group`・`transform`・`canon`・`layout_key`・`problem_keys`・`near_distance`）: 列の構造の自己同型 G（4×4・5×5 は32、6×6 は192）× 補数で、答えのキーと問題のキーを作り、近さを測る。
4. 例の魔方陣を問題集から除くための判定（`example_squares`・`example_keys`）: 4×4 はチュートリアルと遊び方の図の `14 4 5 11 / 9 2 7 16 / 8 13 12 1 / 3 15 10 6`、5×5 は `1 9 8 24 23 / 21 15 10 3 16 / 25 17 12 5 6 / 11 20 13 19 2 / 7 4 22 14 18`。どちらも G × 補数で移る64通りを除く。
5. 4×4 の似すぎを除く規則の判定（供給実験の「推奨の規則」）: 答えが同じ類で与える数のある所の違いが4以下の問題を採らない（`near` 4）、4×4 の答えは回転・裏返しで同じものを1度だけ使う（`unique_d4_answer4`）。ここでは2問・問題の組を与えて採否を返す判定までを作り、問題集の組み立ては次のカードで行う。

## 突き合わせる期待値

- `docs/パズル/導入調査/魔方陣/調査コード/magic_square_supply.expected.json`: `group_sizes`・`group_generator`・`key_definition`・`near_definition`・`squares4`（総数と類の数）・`cases`（盤面ごとのキー・答えのキー・解の数・節点の数）・`transformed`（写した盤面のキーが同じになる）・`near_pairs`・`examples`。キーと近さと解法器（解の数と節点の数）は版に依らないので、ここで一致させる。`cases` の `level` と `assembly_trace`・`pool_summary` は版 4 の分類と組み立ての値なので、このカードでは使わない。
- 解法器の節点の数まで一致させる理由は、難易度の資料 §2.6（上限が採否を変えないことを保つ）。

## 注意

- 調査コードの `magic_square_difficulty.py` は、調査役が版 6 に直している最中で、ファイルが途中で変わることがある。読むのは上の関数だけにする（`docs/パズル/導入調査/魔方陣/` は今までどおり触らない・add しない・status で確かめない）。上の関数は版 6 でも変わらない前提で、変わっていたらメインに知らせる。
- このカードでは固定問題も問題の選び方も変えない（遊べる状態を保つ）。作ったものはテストからだけ使う。
- 完成条件: 上の期待値と一致するテスト（手本の `generator.test.ts`・`problem.test.ts` と同じ種類）。`verify.sh` が通る。
- worktree・ポートはカード 02 と同じ。画面は変えないので撮らなくてよい。

## この項目に効く失敗パターン

`pitfalls.md` の「全項目」の行と、difficulty・problem-pool の行のうち、解法器・同型・重複の除き方に当たるもの。
