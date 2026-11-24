# 再開メモ: 実装役（カード 15 difficulty + problem-pool）

S = /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square、W = $S/work

## 終わったこと（コミット済み、F2 は完了）

- 0a66465b 読むモデル（`problem/generation/read-model.ts`）・値の集まり（`value-mask.ts`）・部品 34 と組み合わせ 5,473（`reading-parts.ts`）・期待値を削った `difficulty-reference.json` とテスト
- 884595f0 特徴（`problem/difficulty-analysis.ts`）と分類（`difficulty.ts`: 梯子 W3・盤面・帯の基準表、`assessMagicSquareDifficulty`、部品は1つずつ読んで違うレベルで止める）とテスト
- 30794491 候補の生成器（`candidate.ts`: 減らす・戻す・磨く）・素朴な解き方（`trial-solver.ts`）・`scripts/analyze-magic-square-difficulty.ts`（reference / timing）
- 6b8e2e9e 期待値の特徴 24 項目を全部突き合わせるテスト
- 確かめ: `analyze ... reference` で 88/88 一致（レベル・理由・最初に違う組み合わせと確かめた数）。timing の結果は `$S/timing-15.log`（TS は Python の約 3〜7 倍速い。負荷 4〜8 の下）

## 未コミットの変更（W。動くが未完）

- `problem/problem-pool.ts`: 固定問題を消し、`problem-pool.json` を読む。1問は `[seed, stuckPlaceCount, tier3PlaceCount, stuckSweepTotal]`、復元に `readingWorkload` を足した
- `problem/problem-pool.json`: 今は小さな試しの問題集（各レベル4問）。本番の問題集で置き換える
- `scripts/generate-magic-square-problem-pool.ts`（新規）: 生成（`--per-level --jobs --batch --cache --out --levels`）と `--verify`（全問の再分類・作業の量・規則・件数・並び・選び方・大きさ）。小さな試しで生成と --verify（壊した項目を3件検出）を確かめた。直近の変更: 戻す候補はこのプロセスで作る（4×4 で子プロセスが毎回全魔方陣を数える無駄を除く）、`--levels`、Decision 型の注記
- `scripts/analyze-magic-square-difficulty.ts`: `pool` サブコマンド（D1・§11 の表・B3/B5/指紋・試遊に渡す問題・代表の格子）を追加
- `package.json`: `generate:magic-square-pool`・`analyze:magic-square-difficulty`。`biome.json`: problem-pool.json を対象外に
- テスト: `problem-pool.test.ts`（500 問・盤面・readingWorkload）、`problem-selection.test.ts`、`play-attempt.test.ts`・`play/use-magic-square-play.test.ts`（答えの分かる固定の盤面を `restoreMagicSquarePoolEntry` で渡す形に）、`views/MagicSquarePlayView.test.tsx`（L1 先頭の問題の答えを解法器で求める）。今の試しの問題集では「500問」のテストだけ落ちる。`answers.test.ts` の全魔方陣の数え上げは負荷が高いと 5 秒を超えて落ちる（既存のテスト）
- `read-model.ts`: 注記3か所の言い直しだけ

## 止めた生成の再開

- キャッシュ `$S/pool-cache.jsonl`（6,657 行、最後は改行で終わっており書きかけの行は無かった。もし書きかけなら最後の行を消す。`CandidateCache` は壊れた行で止まる）。中身: L1 500 問分・L2 は 4×4 70 / 5×5 250 まで・L3 は 5×5 218 / 6×6 196 まで（ログ `$S/pool-gen-L12.log`・`pool-gen-L345.log`）
- 再開（同じ順で続きから。採る問題は jobs・batch に依らない）:
  - 重い L3〜L5 を先に: `cd $W/frontend && bun scripts/generate-magic-square-problem-pool.ts --levels 3,4,5 --jobs 2 --batch 16 --cache $S/pool-cache.jsonl --out $S/pool-v8-L345.json`（L4・L5 は 1 候補 2〜5 秒。残りで 40 分ほどの見込み）
  - L1・L2: `... --levels 1,2 --jobs 1 --batch 16 --cache $S/pool-cache.jsonl --out $S/pool-v8-L12.json`。L2 の 4×4 は答えの向き違いの規則で候補の多くが除かれ、遅い（当たるのは規則を通った候補の約 15%）
  - 最後に全レベルを1回で組む（ほぼキャッシュから）: `... --jobs 2 --cache $S/pool-cache.jsonl --out $W/frontend/src/games/magic-square/problem/problem-pool.json`（出力の統計を残す）
- L2 4×4 の扱い（件数・重複を許すか）と 5×5 の例の除外は、メインの決定待ち。変えるのは `levelPlans`（盤面の比・生成条件）と `problem/example-squares.ts`・`pool-rules.ts`。キャッシュは使い回せる

## 残りの手順と完成条件までの距離

1. メインの決定を `levelPlans` 等に反映 → 生成を最後まで流す（上）
2. `bun scripts/generate-magic-square-problem-pool.ts --verify --jobs 2`（2,500 問で 40〜60 分の見込み。CI の 5 分には収まらない → 手元だけ）
3. `bun scripts/analyze-magic-square-difficulty.ts pool > $S/pool-analysis-15.log`（D1・§11・試遊に渡す問題・F1 の格子）
4. コミット（問題集への切り替え・生成スクリプト・テスト・analyze pool）→ verify.sh（生成物を消してから）
5. `$S/difficulty-checks.md`（下書き: `difficulty-checks-head.md`・`difficulty-checks-static.md`）と `$S/design-game-difficulty-report.md`（下書き: `report15-decisions-draft.md`・`report15-requests-draft.md`・`report15-ripple-draft.md`）を数値で仕上げ、資料の更新案（冒頭・§2.6・§6・§7・§8・§9・§11・付録 A）を「頼むこと」に書く
6. ハンドバック（試遊に渡す問題・頼むこと F1・A4 は頼まない）

完成条件のうち、F2 の一致は済み。残るのは問題集の件数と並び・`--verify` の通過・固定問題の削除（コードでは済み、問題集の差し替え待ち）・verify.sh。
