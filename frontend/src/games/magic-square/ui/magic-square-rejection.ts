import type { MagicSquareOperation } from "@/games/magic-square/play/use-magic-square-play";
import type { MagicSquareCellRejection } from "@/games/magic-square/ui/board/MagicSquareBoard";
import type { MagicSquareValueRejection } from "@/games/magic-square/ui/MagicSquareNumberPad";

/** 受け付けなかった押し方を、選んでいたマスがあればそのマスで、無ければ押した数の札で揺らして返す。 */
export function splitMagicSquareRejection(
  operation: MagicSquareOperation | null,
): {
  cell: MagicSquareCellRejection | null;
  value: MagicSquareValueRejection | null;
} {
  if (operation?.type !== "rejected") {
    return { cell: null, value: null };
  }
  return operation.cellIndex === null
    ? { cell: null, value: { id: operation.id, value: operation.value } }
    : {
        cell: { id: operation.id, cellIndex: operation.cellIndex },
        value: null,
      };
}
