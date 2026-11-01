import type {
  TsumeShogiBoardPiece,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";

const BOARD_SIZE = 9;
/** 成・不成の選択肢は、横に升2つ分、縦に升1つ分を覆う。 */
const PICKER_COLUMNS = 2;
/** 玉を隠すと詰み筋が読めなくなるので、他の駒よりずっと重く数える。 */
const KING_WEIGHT = 10;

/** 選択肢の左上の位置。升の単位で、左端の列（0 が9筋）と上端の段（0 が一段目）。列は半升ずれてよい。 */
export type TsumeShogiPromotionPickerPlacement = {
  column: number;
  row: number;
};

function coveredSquares({
  column,
  row,
}: TsumeShogiPromotionPickerPlacement): TsumeShogiSquare[] {
  const squares: TsumeShogiSquare[] = [];
  for (
    let index = Math.floor(column);
    index < Math.ceil(column + PICKER_COLUMNS);
    index++
  ) {
    squares.push({ file: BOARD_SIZE - index, rank: row + 1 });
  }
  return squares;
}

function isInsideBoard({
  column,
  row,
}: TsumeShogiPromotionPickerPlacement): boolean {
  return (
    column >= 0 &&
    column + PICKER_COLUMNS <= BOARD_SIZE &&
    row >= 0 &&
    row < BOARD_SIZE
  );
}

/**
 * 成・不成の選択肢を、移動先の升を隠さずに、盤上の駒（特に玉）をできるだけ隠さない位置に置く。
 * 候補は移動先の真下・真上（左右に半升ずれた中央寄せ、左寄せ、右寄せ）と、移動先の左右。
 * 隠す駒が同じなら、移動先の下（盤の下半分なら上）の中央寄せを先に選ぶ。
 */
export function placeTsumeShogiPromotionPicker(
  to: TsumeShogiSquare,
  boardPieces: readonly TsumeShogiBoardPiece[],
): TsumeShogiPromotionPickerPlacement {
  const column = BOARD_SIZE - to.file;
  const row = to.rank - 1;
  const verticalRows = to.rank <= 5 ? [row + 1, row - 1] : [row - 1, row + 1];
  const candidates: TsumeShogiPromotionPickerPlacement[] = [
    ...verticalRows.flatMap((candidateRow) => [
      { column: column - 0.5, row: candidateRow },
      { column: column - 1, row: candidateRow },
      { column, row: candidateRow },
    ]),
    { column: column + 1, row },
    { column: column - PICKER_COLUMNS, row },
  ]
    .map((candidate) => ({
      ...candidate,
      column: Math.min(
        Math.max(candidate.column, 0),
        BOARD_SIZE - PICKER_COLUMNS,
      ),
    }))
    .filter(isInsideBoard)
    .filter(
      (candidate) =>
        !coveredSquares(candidate).some(
          (square) => square.file === to.file && square.rank === to.rank,
        ),
    );

  function cost(candidate: TsumeShogiPromotionPickerPlacement): number {
    return coveredSquares(candidate).reduce((sum, square) => {
      const covered = boardPieces.find(
        (boardPiece) =>
          boardPiece.square.file === square.file &&
          boardPiece.square.rank === square.rank,
      );
      if (!covered) return sum;
      return sum + (covered.piece.type === "king" ? KING_WEIGHT : 1);
    }, 0);
  }

  return candidates.reduce((best, candidate) =>
    cost(candidate) < cost(best) ? candidate : best,
  );
}
