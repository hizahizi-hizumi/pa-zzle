import { useRef } from "react";

import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { useTouchTap } from "@/components/touch-tap";
import {
  formatTsumeShogiSquareKey,
  type TsumeShogiPlayedMove,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
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
import { TsumeShogiBoardWood } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiBoardWood";
import { TsumeShogiCoordinateLabel } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiCoordinateLabel";
import { TsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiPromotionPicker";
import {
  TsumeShogiSquareButton,
  type TsumeShogiSquareHighlight,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiSquareButton";
import { pieceMotionSelector } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useRejectedPieceFeedback } from "@/games/tsume-shogi/ui/use-rejected-piece-feedback";
import { cn } from "@/lib/utils";

type TsumeShogiBoardProps = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  /** 盤上の駒ごとの、指し手で変わらない識別（`formatTsumeShogiSquareKey` の升から）。駒ごとの木目の位置を決める。 */
  boardPieceIds: ReadonlyMap<string, string>;
  selection: TsumeShogiSelection | null;
  /** 盤面に見せている最後の組の手。 */
  shownMoves: readonly TsumeShogiPlayedMove[];
  /** `shownMoves` が、待ったなどで盤面に戻ってきた手か。指した手ではないので駒を動かして見せない。 */
  shownMovesRestored: boolean;
  promotionChoice: TsumeShogiPromotionChoice | null;
  rejection: TsumeShogiRejection | null;
  mated: boolean;
  interactionDisabled: boolean;
  /**
   * チュートリアルで次に押す升の印。`recallId` は印の無い所が押されるたびに変え、印の線を短く濃くして戻す。
   * 本番では渡さない。
   */
  tutorialMark?: { square: TsumeShogiSquare; recallId: number | null } | null;
  /**
   * チュートリアルで決め手を見せる間、盤の升の中だけを薄く覆い、元の明るさで残す升。覆わないときと本番では `null`。
   */
  spotlitSquares?: readonly TsumeShogiSquare[] | null;
  onSelectSquare: (square: TsumeShogiSquare) => void;
  onChoosePromotion: (promote: boolean) => void;
};

/** 左が9筋、上が1段目。攻方（利用者）から見た向き。 */
const files = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const selectedPieceGlyphSelector = `[data-selected-piece] ${pieceMotionSelector}`;

/** 星。3筋と4筋・6筋と7筋の境、三段と四段・六段と七段の境が交わる4点。 */
const starPoints = [
  { left: "33.333%", top: "33.333%" },
  { left: "66.667%", top: "33.333%" },
  { left: "33.333%", top: "66.667%" },
  { left: "66.667%", top: "66.667%" },
] as const;

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

export function TsumeShogiBoard({
  boardPieces,
  boardPieceIds,
  selection,
  shownMoves,
  shownMovesRestored,
  promotionChoice,
  rejection,
  mated,
  interactionDisabled,
  tutorialMark = null,
  spotlitSquares = null,
  onSelectSquare,
  onChoosePromotion,
}: TsumeShogiBoardProps) {
  const { getTapHandlers } = useTouchTap();
  const squaresRef = useRef<HTMLDivElement>(null);
  const lastMove = shownMoves.at(-1) ?? null;
  const promotingPiece = promotionChoice
    ? findPiece(boardPieces, promotionChoice.from)
    : null;

  const rejectedPieceFlashing = useRejectedPieceFeedback(
    rejection,
    squaresRef,
    selectedPieceGlyphSelector,
  );

  function getHighlight(
    square: TsumeShogiSquare,
  ): TsumeShogiSquareHighlight | null {
    const piece = findPiece(boardPieces, square);
    if (mated && piece?.type === "king") return "mated";
    if (
      selection?.type === "board" &&
      isSameTsumeShogiSquare(selection.square, square)
    ) {
      return rejectedPieceFlashing ? "rejected" : "selected";
    }
    if (lastMove && isSameTsumeShogiSquare(lastMove.move.to, square)) {
      return lastMove.side === "defender" && lastMove.line === "wrong"
        ? "refutation"
        : "last-move";
    }
    return null;
  }

  return (
    <div className="grid size-full grid-cols-[var(--board-frame)_minmax(0,1fr)_var(--board-frame)] grid-rows-[var(--board-frame)_minmax(0,1fr)_var(--board-frame)_var(--board-thickness)]">
      <TsumeShogiBoardWood />
      <div
        aria-hidden="true"
        className={cn(
          "relative col-start-2 row-start-1 grid grid-cols-9 items-center text-[0.625rem] leading-none",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        {files.map((file) => (
          <TsumeShogiCoordinateLabel key={file} text={String(file)} />
        ))}
      </div>
      <div
        ref={squaresRef}
        data-board-squares=""
        role="group"
        aria-label="盤"
        {...(spotlitSquares !== null && {
          [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "",
        })}
        className={cn(
          "relative col-start-2 row-start-2 grid grid-cols-9 grid-rows-9",
        )}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = { file, rank };
            const arrivedMove =
              lastMove &&
              !shownMovesRestored &&
              isSameTsumeShogiSquare(lastMove.move.to, square)
                ? lastMove
                : null;
            return (
              <TsumeShogiSquareButton
                key={`${file}-${rank}`}
                square={square}
                piece={findPiece(boardPieces, square)}
                pieceId={
                  boardPieceIds.get(formatTsumeShogiSquareKey(square)) ?? null
                }
                arrivedMove={arrivedMove}
                highlight={getHighlight(square)}
                tutorialMarkRecallId={
                  tutorialMark &&
                  isSameTsumeShogiSquare(tutorialMark.square, square)
                    ? tutorialMark.recallId
                    : undefined
                }
                spotlit={
                  spotlitSquares?.some((spotlit) =>
                    isSameTsumeShogiSquare(spotlit, square),
                  ) ?? false
                }
                disabled={interactionDisabled}
                tapHandlers={getTapHandlers(() => onSelectSquare(square))}
                onLeftEdge={file === files[0]}
                onTopEdge={rank === ranks[0]}
              />
            );
          }),
        )}
        {starPoints.map(({ left, top }) => (
          <span
            key={`${left}-${top}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute size-[clamp(3px,calc(var(--board-width)*0.008),4px)] -translate-1/2 rounded-full",
              tsumeShogiToneClassNames.boardStar,
            )}
            style={{ left, top }}
          />
        ))}
        {promotionChoice && promotingPiece && (
          <TsumeShogiPromotionPicker
            to={promotionChoice.to}
            pieceType={promotingPiece.type}
            optionTapHandlers={{
              promote: getTapHandlers(() => onChoosePromotion(true)),
              keep: getTapHandlers(() => onChoosePromotion(false)),
            }}
          />
        )}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "relative col-start-3 row-start-2 grid grid-rows-9 text-[0.625rem] leading-none",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        {ranks.map((rank) => (
          <span key={rank} className="flex items-center justify-center">
            <TsumeShogiCoordinateLabel text={formatTsumeShogiRank(rank)} />
          </span>
        ))}
      </div>
    </div>
  );
}
