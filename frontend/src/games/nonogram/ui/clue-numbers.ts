import type { NonogramClue } from "@/games/nonogram/puzzle/clue";

/** ヒントとして見せる数字の並び。黒の無い行・列のヒントは `0` と示す。 */
export function listNonogramClueNumbers(clue: NonogramClue): readonly number[] {
  return clue.length === 0 ? [0] : clue;
}
