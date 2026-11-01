/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `fitted`: 手順の印のマスに、手順どおりの操作をしたことを、そのマスを一瞬光らせて示す。
 * - `reason`: 開いたマスや旗を置いたマスが決まった理由の数字を、一瞬光らせる。
 * - `hint`: 次に操作するマスを、出た瞬間から分かる強さで示す。
 */
export type MinesweeperCellCueKind = "fitted" | "reason" | "hint";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type MinesweeperCellCue = {
  cellIndex: number;
  kind: MinesweeperCellCueKind;
  id: number;
};
