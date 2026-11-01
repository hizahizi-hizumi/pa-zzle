/**
 * マスに重ねる合図。チュートリアルで、見るところと押すところを説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次に押すマスを、出た瞬間から分かる強さで示す。
 * - `focus`: 押すマスを決める数字を、見るところとして示す。
 */
export type MinesweeperCellCueKind = "hint" | "focus";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type MinesweeperCellCue = {
  cellIndex: number;
  kind: MinesweeperCellCueKind;
  id: number;
};
