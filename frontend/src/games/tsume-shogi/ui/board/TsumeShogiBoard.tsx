import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  isSameTsumeShogiSquare,
  type TsumeShogiBoardPiece,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import type { TsumeShogiSelection } from "@/games/tsume-shogi/session/session";
import {
  formatTsumeShogiRank,
  formatTsumeShogiSquare,
  tsumeShogiPieceCharacters,
  tsumeShogiPieceNames,
} from "@/games/tsume-shogi/ui/piece-label";
import { cn } from "@/lib/utils";

type TsumeShogiBoardProps = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  selection: TsumeShogiSelection | null;
  lastMove: TsumeShogiMove | null;
  disabled: boolean;
  onTapSquare: (square: TsumeShogiSquare) => void;
};

const files = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 攻方から見た9×9の盤。上に筋、右に段を示す。 */
export function TsumeShogiBoard({
  boardPieces,
  selection,
  lastMove,
  disabled,
  onTapSquare,
}: TsumeShogiBoardProps) {
  function findPiece(square: TsumeShogiSquare) {
    return boardPieces.find((boardPiece) =>
      isSameTsumeShogiSquare(boardPiece.square, square),
    )?.piece;
  }

  return (
    <div
      role="group"
      aria-label="盤"
      className="grid grid-cols-[repeat(9,minmax(0,1fr))_auto] gap-0"
    >
      {files.map((file) => (
        <span
          key={file}
          className="text-center text-meta text-muted-foreground"
          aria-hidden
        >
          {file}
        </span>
      ))}
      <span aria-hidden />
      {ranks.map((rank) => (
        <div key={rank} className="contents">
          {files.map((file) => {
            const square = { file, rank };
            const piece = findPiece(square);
            const selected =
              selection?.type === "board" &&
              isSameTsumeShogiSquare(selection.square, square);
            const lastMoved =
              lastMove !== null && isSameTsumeShogiSquare(lastMove.to, square);
            return (
              <button
                key={file}
                type="button"
                aria-label={`${formatTsumeShogiSquare(square)}${
                  piece
                    ? ` ${piece.side === "attacker" ? "攻方" : "玉方"}の${tsumeShogiPieceNames[piece.type]}`
                    : ""
                }`}
                aria-pressed={selected}
                disabled={disabled}
                className={cn(
                  "flex aspect-square items-center justify-center border border-border text-lg leading-none",
                  lastMoved && "bg-muted",
                  selected && "bg-primary text-primary-foreground",
                )}
                onClick={() => onTapSquare(square)}
              >
                {piece && (
                  <span
                    className={cn(piece.side === "defender" && "rotate-180")}
                  >
                    {tsumeShogiPieceCharacters[piece.type]}
                  </span>
                )}
              </button>
            );
          })}
          <span
            className="flex items-center pl-1 text-meta text-muted-foreground"
            aria-hidden
          >
            {formatTsumeShogiRank(rank)}
          </span>
        </div>
      ))}
    </div>
  );
}
