/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `fitted`: 手順の印のマスを手順どおりにしたことに、その瞬間だけ控えめに応える。
 * - `hint`: 次に操作するマスの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いマスを押されたときや、手順と違う操作をされたときに使う。
 */
export type MinesweeperCellCueKind = "fitted" | "hint" | "recall";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type MinesweeperCellCue = {
  cellIndex: number;
  kind: MinesweeperCellCueKind;
  id: number;
};
