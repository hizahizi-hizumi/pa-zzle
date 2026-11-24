## 5. 頼むこと

### 独立した確かめ（F1）

- 確かめてほしいこと: 基準の読むモデル（版 8）が、各レベルの代表で、資料 §2.2 の読み（列・鎖・台・組の数を他で使わない・この数はここだけ、1巡は同じ写しから読んで重ねる、行き詰まりでは段2〜4を始めから）どおりに所の段と巡を出しているか。上のレベルが、モデルの言う段より浅い読み（段1の読みと、空き2の列を1本ずつ読む読みだけ）で解けてしまわないか。答え（下の格子の下段）を落とさないか。
- 見る場所: 読むモデル `frontend/src/games/magic-square/problem/generation/read-model.ts`（`readMagicSquare`）、特徴 `frontend/src/games/magic-square/problem/difficulty-analysis.ts`（`summarizeMagicSquareReading`）、梯子と帯 `frontend/src/games/magic-square/difficulty.ts`、読み方の部品 `frontend/src/games/magic-square/problem/generation/reading-parts.ts`。所ごとの記録は `bun -e` などで `readMagicSquare(size, givens)` を呼ぶと出る（`steps` の段・巡・決まったマス）。
- 盤面: 「試遊に渡す問題」の代表の格子（上段が与える数で `.` が空き、下段が答え）。

### A4（反例探し）

頼まない。PO の判断で6回で打ち切り、移植で版 8 の定義を変えていない（調査コードの期待値 88 候補で、段・巡・レベル・範囲外の理由まで一致）。

### 後の項目に渡すもの

- score: 問題集の各問が、基準の読みの作業の量 `readingWorkload`（組を突き合わせた所の数 `stuckPlaceCount`・段3の所の数 `tier3PlaceCount`・組を突き合わせた所の巡の合計 `stuckSweepTotal`）を持つ（`frontend/src/games/magic-square/problem/problem-pool.ts` の `restoreMagicSquarePoolEntry`）。記録の `workload` は空きマスの数のまま。分布は下の「下流に渡す量」と、資料 §11（調査の値）。基準時間に使う量を決めて記録の形を変えるのは score の項目。
- zukan: 問題の特徴の軸（盤面・最初の数）は今のまま。レベルごとの幅は下の「下流に渡す量」の空き・与える数の列。
- spec: 資料 §12 のパズル仕様の難易度の節の案（版 8）はそのまま使える。値（巡の上限 4・帯・盤面の割り当て・部品 34 と組み合わせ 5,473 通り）はコード（`difficulty.ts`・`reading-parts.ts`）が正。
- レベルごとの一言: 資料 §4.3（版 8）。

### 難易度の資料の更新（資料は導入調査のディレクトリにあり、実装役は触らない）
