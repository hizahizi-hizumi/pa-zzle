import { useTouchTap } from "@/components/touch-tap";
import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  isSameTsumeShogiSquare,
  type TsumeShogiBoardPiece,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import type {
  TsumeShogiPromotionChoice,
  TsumeShogiRejection,
  TsumeShogiSelection,
} from "@/games/tsume-shogi/session/session";
import { TsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiPromotionPicker";
import {
  TsumeShogiSquareButton,
  type TsumeShogiSquareHighlight,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiSquareButton";
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiBoardProps = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  selection: TsumeShogiSelection | null;
  /** 盤面に見せている最後の組の手。最後の手の移動先の地を変え、その駒を動かして見せる。 */
  shownMoves: readonly TsumeShogiPlayedMove[];
  promotionChoice: TsumeShogiPromotionChoice | null;
  rejection: TsumeShogiRejection | null;
  /** 詰んだ玉の升の地を変える。 */
  mated: boolean;
  disabled: boolean;
  onTapSquare: (square: TsumeShogiSquare) => void;
  onChoosePromotion: (promote: boolean) => void;
};

/** 左が9筋、上が1段目。攻方（利用者）から見た向き。 */
const files = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function findPiece(
  boardPieces: readonly TsumeShogiBoardPiece[],
  square: TsumeShogiSquare,
) {
  return (
    boardPieces.find((boardPiece) =>
      isSameTsumeShogiSquare(boardPiece.square, square),
    )?.piece ?? null
  );
}

/**
 * 9×9 の盤。上に筋、右に段を示す。升全体を押せる。
 * 移動先の候補は示さない（どの手が王手になるかを読むことがこのゲームの考えどころなので、合法手を盤に出さない）。
 */
export function TsumeShogiBoard({
  boardPieces,
  selection,
  shownMoves,
  promotionChoice,
  rejection,
  mated,
  disabled,
  onTapSquare,
  onChoosePromotion,
}: TsumeShogiBoardProps) {
  const { getTapHandlers } = useTouchTap();
  const lastMove = shownMoves.at(-1) ?? null;
  const promotingPiece = promotionChoice
    ? findPiece(boardPieces, promotionChoice.from)
    : null;

  function getHighlight(
    square: TsumeShogiSquare,
  ): TsumeShogiSquareHighlight | null {
    const piece = findPiece(boardPieces, square);
    if (mated && piece?.type === "king") return "mated";
    if (rejection && isSameTsumeShogiSquare(rejection.to, square)) {
      return "rejected";
    }
    if (
      selection?.type === "board" &&
      isSameTsumeShogiSquare(selection.square, square)
    ) {
      return "selected";
    }
    if (lastMove && isSameTsumeShogiSquare(lastMove.move.to, square)) {
      return lastMove.side === "defender" && lastMove.line === "wrong"
        ? "refutation"
        : "last-move";
    }
    return null;
  }

  return (
    <div className="grid size-full grid-cols-[minmax(0,1fr)_0.5625rem] grid-rows-[0.75rem_minmax(0,1fr)] gap-x-px">
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-cols-9 text-center text-[0.625rem] leading-3 tabular-nums",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        {files.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
      <span aria-hidden="true" />
      <div
        role="group"
        aria-label="盤"
        className={cn(
          "relative grid grid-cols-9 grid-rows-9 outline-2 outline-solid",
          tsumeShogiToneClassNames.boardSurface,
          tsumeShogiToneClassNames.boardOutline,
        )}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = { file, rank };
            const arrivedMove =
              lastMove && isSameTsumeShogiSquare(lastMove.move.to, square)
                ? lastMove
                : null;
            return (
              <TsumeShogiSquareButton
                key={`${file}-${rank}`}
                square={square}
                piece={findPiece(boardPieces, square)}
                arrivedMove={arrivedMove}
                highlight={getHighlight(square)}
                disabled={disabled}
                tapHandlers={getTapHandlers(() => onTapSquare(square))}
                isLastFile={file === 1}
                isLastRank={rank === 9}
              />
            );
          }),
        )}
        {promotionChoice && promotingPiece && (
          <TsumeShogiPromotionPicker
            to={promotionChoice.to}
            pieceType={promotingPiece.type}
            onChoose={onChoosePromotion}
          />
        )}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-rows-9 text-[0.625rem] leading-3",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        {ranks.map((rank) => (
          <span key={rank} className="flex items-center justify-center">
            {formatTsumeShogiRank(rank)}
          </span>
        ))}
      </div>
    </div>
  );
}
