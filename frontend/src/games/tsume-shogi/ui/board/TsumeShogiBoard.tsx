import { type CSSProperties, useRef } from "react";

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
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useRejectedPieceFeedback } from "@/games/tsume-shogi/ui/use-rejected-piece-feedback";
import { cn } from "@/lib/utils";

type TsumeShogiBoardProps = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  /** 盤上の駒ごとの、指し手で変わらない識別（`formatTsumeShogiSquareKey` の升から）。駒ごとの木目の位置を決める。 */
  boardPieceIds: ReadonlyMap<string, string>;
  selection: TsumeShogiSelection | null;
  /** 盤面に見せている最後の組の手。最後の手の移動先の地を変え、その駒を動かして見せる。 */
  shownMoves: readonly TsumeShogiPlayedMove[];
  /** `shownMoves` が、待ったなどで盤面に戻ってきた手か。指した手ではないので駒を動かして見せない。 */
  shownMovesRestored: boolean;
  promotionChoice: TsumeShogiPromotionChoice | null;
  /** 直前の入力を着手させなかった。選んでいる盤上の駒で返す。 */
  rejection: TsumeShogiRejection | null;
  /** 詰み上がり。詰んだ玉を傾ける。 */
  mated: boolean;
  interactionDisabled: boolean;
  onSelectSquare: (square: TsumeShogiSquare) => void;
  onChoosePromotion: (promote: boolean) => void;
};

/** 左が9筋、上が1段目。攻方（利用者）から見た向き。 */
const files = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * 盤の縁と表記の寸法。盤の木の四辺に同じ幅の縁（`--board-frame`）を取り、上の縁に筋、右の縁に段を書く。
 * 四辺が同じ幅なので、盤の木そのものが左右の中央に来る。幅の広い画面ほど縁を太くする。
 * 320px でも盤を画面の縁に付けず、卓に置いた盤に見える余白を左右に残す（`--board-gutter`）。
 * 盤を置く画面は、この寸法を含めて盤の大きさを決める。
 * `--piece-box-height`・`--komadai-height` は盤の上下の駒箱の札・駒台の欄の高さ、`--komadai-gap` は盤と駒台の間。
 */
export const tsumeShogiBoardFrameStyle = {
  "--board-gutter": "clamp(6px, calc(6px + (100cqw - 320px) / 7), 14px)",
  "--board-frame": "clamp(16px, calc(16px + (100cqw - 320px) / 14), 21px)",
  "--piece-box-height": "1.5rem",
  "--komadai-height": "3.75rem",
  "--komadai-gap": "10px",
} as CSSProperties;

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

/**
 * 9×9 の盤。真上から見た榧の盤で、木の縁の上に筋、右に段を書き、星を打つ。升全体を押せる。
 * 移動先の候補は示さない（どの手が王手になるかを読むことがこのゲームの考えどころなので、合法手を盤に出さない）。
 */
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
    <div className="grid size-full grid-cols-[var(--board-frame)_minmax(0,1fr)_var(--board-frame)] grid-rows-[var(--board-frame)_minmax(0,1fr)_var(--board-frame)]">
      <TsumeShogiBoardWood />
      <div
        aria-hidden="true"
        className={cn(
          "relative col-start-2 row-start-1 grid grid-cols-9 items-center text-[0.75rem] leading-none",
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
          "relative col-start-2 row-start-2 grid grid-cols-9 grid-rows-9 outline-1 outline-solid",
          tsumeShogiToneClassNames.boardOutline,
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
          "relative col-start-3 row-start-2 grid grid-rows-9 text-[0.75rem] leading-none",
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
