import { type CSSProperties, useRef } from "react";

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
import { RealBoardWood } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/RealBoardWood";
import { TsumeShogiCoordinateLabel } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiCoordinateLabel";
import { TsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiPromotionPicker";
import {
  TsumeShogiSquareButton,
  type TsumeShogiSquareHighlight,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/TsumeShogiSquareButton";
import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useRejectedPieceFeedback } from "@/games/tsume-shogi/ui/use-rejected-piece-feedback";
import { cn } from "@/lib/utils";

type TsumeShogiBoardProps = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  selection: TsumeShogiSelection | null;
  /** 盤面に見せている最後の組の手。最後の手の移動先の地を変え、その駒を動かして見せる。 */
  shownMoves: readonly TsumeShogiPlayedMove[];
  /** `shownMoves` が、待ったなどで盤面に戻ってきた手か。指した手ではないので駒を動かして見せない。 */
  shownMovesRestored: boolean;
  promotionChoice: TsumeShogiPromotionChoice | null;
  /** 直前の入力を着手させなかった。選んでいる盤上の駒で返す。 */
  rejection: TsumeShogiRejection | null;
  /** 詰んだ玉の升の地を変える。 */
  mated: boolean;
  interactionDisabled: boolean;
  onSelectSquare: (square: TsumeShogiSquare) => void;
  onChoosePromotion: (promote: boolean) => void;
};

/** 左が9筋、上が1段目。攻方（利用者）から見た向き。 */
const files = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * 盤の縁と表記の寸法。升の左と下の縁（`--board-frame`）、筋を書く上の縁（`--board-file-band`）、
 * 段を書く右の縁（`--board-rank-band`）。320px では左右の縁を合わせて 14px に収め、升を 34px に保つ。
 * 幅の広い画面ほど縁を太くする。盤を置く画面は、この寸法を含めて盤の大きさを決める。
 */
const currentFrameStyle = {
  "--board-frame": "clamp(3px, calc(3px + (100cqw - 320px) / 20), 6px)",
  "--board-rank-band": "clamp(11px, calc(11px + (100cqw - 320px) / 14), 16px)",
  "--board-file-band": "1rem",
  "--board-bottom": "var(--board-frame)",
} as CSSProperties;

/** 案S: 縁を持たない。外枠の線が画面の端にかからない分だけ空ける。 */
const quietFrameStyle = {
  "--board-frame": "2px",
  "--board-rank-band": "clamp(13px, calc(13px + (100cqw - 320px) / 14), 18px)",
  "--board-file-band": "0.875rem",
  "--board-bottom": "var(--board-frame)",
} as CSSProperties;

/**
 * 案R: 木の盤の縁（`--board-frame`）の外に筋・段を書き、盤の下に手前の側面（木口）をのぞかせる。
 * 筋・段の帯と盤の下の欄は、縁と側面を含めた寸法。
 */
const realFrameStyle = {
  // 320px でも盤を画面の縁に付けず、置いた盤に見える余白を左右に残す。
  "--board-gutter": "clamp(6px, calc(6px + (100cqw - 320px) / 7), 12px)",
  "--board-frame": "clamp(7px, calc(7px + (100cqw - 320px) / 16), 12px)",
  "--board-rank-band":
    "calc(var(--board-frame) + clamp(15px, calc(15px + (100cqw - 320px) / 14), 19px))",
  "--board-file-band": "calc(var(--board-frame) + 0.9375rem)",
  "--board-bottom":
    "calc(var(--board-frame) + clamp(7px, calc(7px + (100cqw - 320px) / 16), 11px))",
} as CSSProperties;

export const tsumeShogiBoardFrameStyle = {
  current: currentFrameStyle,
  quiet: quietFrameStyle,
  real: realFrameStyle,
}[tsumeShogiBoardStyle];

const selectedPieceGlyphSelector = "[data-selected-piece] > svg";

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

const coordinateTextClassNames = {
  current: "text-[0.6875rem]",
  quiet: "text-[0.625rem]",
  real: "text-[0.75rem]",
} as const;

/**
 * 9×9 の盤。木の縁の上に筋、右に段を書き、星を打つ。升全体を押せる。
 * 移動先の候補は示さない（どの手が王手になるかを読むことがこのゲームの考えどころなので、合法手を盤に出さない）。
 */
export function TsumeShogiBoard({
  boardPieces,
  selection,
  shownMoves,
  shownMovesRestored,
  promotionChoice,
  rejection,
  mated,
  interactionDisabled,
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
    <div
      className={cn(
        "grid size-full grid-cols-[var(--board-frame)_minmax(0,1fr)_var(--board-rank-band)] grid-rows-[var(--board-file-band)_minmax(0,1fr)_var(--board-bottom)]",
        tsumeShogiBoardStyle === "current" && "rounded-[3px]",
        tsumeShogiToneClassNames.boardSlab,
      )}
    >
      {tsumeShogiBoardStyle === "real" && <RealBoardWood />}
      <div
        aria-hidden="true"
        className={cn(
          "col-start-2 row-start-1 grid grid-cols-9 items-center text-center leading-none font-medium tabular-nums",
          coordinateTextClassNames[tsumeShogiBoardStyle],
          tsumeShogiBoardStyle === "real" && "pb-(--board-frame)",
          tsumeShogiBoardStyle === "quiet" && "pb-1",
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
        className={cn(
          "relative col-start-2 row-start-2 grid grid-cols-9 grid-rows-9 outline-solid",
          tsumeShogiBoardStyle === "real"
            ? "outline-1"
            : "outline-(length:--border-width-strong)",
          tsumeShogiBoardStyle !== "real" &&
            tsumeShogiToneClassNames.boardSurface,
          tsumeShogiToneClassNames.boardOutline,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0",
            tsumeShogiToneClassNames.boardGrain,
          )}
        />
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
                arrivedMove={arrivedMove}
                highlight={getHighlight(square)}
                disabled={interactionDisabled}
                tapHandlers={getTapHandlers(() => onSelectSquare(square))}
                isLastFile={file === 1}
                isLastRank={rank === 9}
              />
            );
          }),
        )}
        {starPoints.map(({ left, top }) => (
          <span
            key={`${left}-${top}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -translate-1/2 rounded-full",
              {
                current: "size-[5px]",
                quiet: "size-1",
                real: "size-[clamp(3px,calc(var(--board-width)*0.008),4px)]",
              }[tsumeShogiBoardStyle],
              tsumeShogiToneClassNames.boardStar,
            )}
            style={{ left, top }}
          />
        ))}
        {promotionChoice && promotingPiece && (
          <TsumeShogiPromotionPicker
            to={promotionChoice.to}
            pieceType={promotingPiece.type}
            boardPieces={boardPieces}
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
          "col-start-3 row-start-2 grid grid-rows-9 leading-none font-medium",
          coordinateTextClassNames[tsumeShogiBoardStyle],
          tsumeShogiBoardStyle === "real" && "pl-(--board-frame)",
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
