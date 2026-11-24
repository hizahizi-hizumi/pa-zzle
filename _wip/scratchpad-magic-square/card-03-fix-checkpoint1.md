# 作業カード 03: 直し（山場1 のコードレビューの所見）

play-ui（カード 02）を作り終えた後に行う。play-ui で同じファイルを作り替えていれば、今の形に当てはめて直す（所見の行番号は `0b67227b` のもの）。

## 直す所見（すべて Minor・振り分けは「直す」）

1. `puzzle/rules.test.ts`: 「最初から置いてある数を変えられない」を性質テストで確かめる。ランダムな途中盤面の `samples` で盤面の数を givens とみなし、最初からある全部のマスに `placeMagicSquareValue`・`removeMagicSquareValue`・`enterMagicSquareValue`・`toggleMagicSquareMemo` を乱数の数でかけ、受け取った状態がそのまま返ることを全サンプルで確かめる。
2. `play-record.ts`: `restoreMagicSquareRecordedResult` が読み戻した `performance`・`workload` をそのまま渡している。bridges の `copyPerformance`・`copyWorkload` のように写す関数を作り、作るときと読み戻すときの両方で使う。
3. `puzzle/board.ts` の `isSameMagicSquareLine`、`problem/problem.ts` の `createMagicSquareProblemIdentity`: 本体から使っていなければ export を外して `_private` 経由でテストから参照する（play-ui・problem-pool で本体から使うなら、そのときの export のままでよい）。
4. `problem/problem-pool.ts`: seed の書き方（`.` 区切り、空き `"0"`）を書き直している。problem.ts に seed から一辺と最初の数の個数を読む関数を置き、`toMagicSquarePoolIdentity`・`findMagicSquarePoolProblemFeatures` はそれを使う。
5. `problem/problem.ts` の `isCurrentMagicSquareProblemIdentity` の JSDoc が「今の生成器で復元できる」と言うが、実際は復号できるかだけを見ている。コメントを実際に合わせるか、空きと違反の判定も入れてコメントどおりにする。
6. `ui/MagicSquareHowToPlayDialog.tsx`: 「4×4なら34、5×5なら65、6×6なら111」「1から16まで」の直書きを、`magicSquareBoardSizes`・`getMagicSquareMagicSum`・`getMagicSquareMaxValue` から組み立てる（遊び方の作り込みは後の項目だが、盤面の大きさの定義とずれる直書きは今やめる）。
7. describe の名前を `.claude/rules/vitest.md` の命名規則に合わせる: `session/session.test.ts` の「取り下げの回数」→ 対象の関数名、`puzzle/rules.test.ts` の「盤面の操作」→ 条件（「〜の場合」）、`problem/problem-pool.test.ts` の「問題集」→ 対象の関数ごと。
8. `ui/board/MagicSquareBoard.test.tsx`・`ui/MagicSquareHowToPlayDialog.test.tsx`: `getByText("合計").nextSibling` を expect の中でたどる確かめ方と、利用者から見えない `data-line-status` での確かめ方を、利用者に見える契約（表示の文言、読み上げ名、一致・違反の見え方）に替える。
9. `ui/MagicSquarePlay.test.tsx`・`views/MagicSquarePlayView.test.tsx`: テスト名どおりに、取り下げの指標の要素を取り出して、その中に回数があることを `within` で確かめる（取り下げの呼び名と見せ方は score の項目で変わりうる。そのときは score の項目でテストも合わせる）。

`.claude/rules/game-structure.md` の「11ゲーム」は文書の層（spec）で扱うので、このカードでは触らない。

## worktree とポート

カード 02 と同じ。

## 注意

カード 01 と同じ（`docs/パズル/導入調査/魔方陣/` は触らない）。

## 完成条件

上の9件を直し、`verify.sh` が通る。
