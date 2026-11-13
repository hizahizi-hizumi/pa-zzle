import {
  getHakoiriMusumeArrangementKey,
  type HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 解いている途中の盤面。駒の並びの順は問題の駒の順のまま変えず、何番目の駒かで同じ駒を指す。
 * 動いた駒だけが新しい値になり、ほかの駒は前の状態と同じ値を共有する。
 */
export type HakoiriMusumeState = {
  pieces: readonly HakoiriMusumePiece[];
};

export function createHakoiriMusumeInitialState(
  pieces: readonly HakoiriMusumePiece[],
): HakoiriMusumeState {
  return { pieces };
}

/** 目標でない同じ形の駒どうしが入れ替わっただけの盤面は同じとみなす。 */
export function isSameHakoiriMusumeBoard(
  left: HakoiriMusumeState,
  right: HakoiriMusumeState,
): boolean {
  return (
    left === right ||
    getHakoiriMusumeArrangementKey(left.pieces) ===
      getHakoiriMusumeArrangementKey(right.pieces)
  );
}
