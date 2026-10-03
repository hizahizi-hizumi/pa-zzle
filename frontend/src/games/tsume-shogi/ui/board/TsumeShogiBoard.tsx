import type { CSSProperties } from "react";

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
  /** `shownMoves` が、元に戻すなどで盤面に戻ってきた手か。指した手ではないので駒を動かして見せない。 */
  shownMovesRestored: boolean;
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

/**
 * 盤の縁と表記の寸法。升の左と下の縁（`--board-frame`）、筋を書く上の縁（`--board-file-band`）、
 * 段を書く右の縁（`--board-rank-band`）。320px では左右の縁を合わせて 14px に収め、升を 34px に保つ。
 * 幅の広い画面ほど縁を太くする。盤を置く画面は、この寸法を含めて盤の大きさを決める。
 */
export const tsumeShogiBoardFrameStyle = {
  "--board-frame": "clamp(3px, calc(3px + (100cqw - 320px) / 20), 6px)",
  "--board-rank-band": "clamp(11px, calc(11px + (100cqw - 320px) / 14), 16px)",
  "--board-file-band": "1rem",
} as CSSProperties;

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
    <div
      className={cn(
        "grid size-full grid-cols-[var(--board-frame)_minmax(0,1fr)_var(--board-rank-band)] grid-rows-[var(--board-file-band)_minmax(0,1fr)_var(--board-frame)] rounded-[3px]",
        tsumeShogiToneClassNames.boardSlab,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "col-start-2 row-start-1 grid grid-cols-9 items-center text-center text-[0.6875rem] leading-none font-medium tabular-nums",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        {files.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
      <div
        role="group"
        aria-label="盤"
        className={cn(
          "relative col-start-2 row-start-2 grid grid-cols-9 grid-rows-9 outline-(length:--border-width-strong) outline-solid",
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
                disabled={disabled}
                tapHandlers={getTapHandlers(() => onTapSquare(square))}
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
              "pointer-events-none absolute size-[5px] -translate-1/2 rounded-full",
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
          "col-start-3 row-start-2 grid grid-rows-9 text-[0.6875rem] leading-none font-medium",
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
