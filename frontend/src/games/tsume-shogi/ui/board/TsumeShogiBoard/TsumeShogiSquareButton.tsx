import type {
  TsumeShogiPiece,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import {
  formatTsumeShogiSquare,
  tsumeShogiPieceNames,
} from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 升の地が示す状態。
 * - `selected`: 選んでいる攻方の駒。
 * - `last-move`: 最後に指した手の移動先。
 * - `mated`: 詰んだ玉。地は変えず、玉を傾ける。
 */
export type TsumeShogiSquareHighlight = "selected" | "last-move" | "mated";

const highlightClassNames = {
  selected: tsumeShogiToneClassNames.squareSelected,
  "last-move": tsumeShogiToneClassNames.squareLastMove,
  // 詰みは升の地を変えず、玉の傾き（`matedPieceTilt`）で示す。
  mated: "",
} as const satisfies Record<TsumeShogiSquareHighlight, string>;

type TsumeShogiSquareButtonProps = {
  square: TsumeShogiSquare;
  piece: TsumeShogiPiece | null;
  highlight: TsumeShogiSquareHighlight | null;
  disabled: boolean;
  onSelect: () => void;
  isLastFile: boolean;
  isLastRank: boolean;
};

export function TsumeShogiSquareButton({
  square,
  piece,
  highlight,
  disabled,
  onSelect,
  isLastFile,
  isLastRank,
}: TsumeShogiSquareButtonProps) {
  const pieceLabel = piece
    ? ` ${piece.side === "attacker" ? "攻方" : "玉方"}の${tsumeShogiPieceNames[piece.type]}`
    : "";
  // 選べるのは攻方の駒の升だけなので、その升だけを選択の切り替えとして読み上げる。
  const selectable = piece?.side === "attacker";
  const selected = highlight === "selected";

  return (
    <button
      type="button"
      aria-label={`${formatTsumeShogiSquare(square)}${pieceLabel}`}
      aria-pressed={selectable ? selected : undefined}
      disabled={disabled}
      data-mated-king={highlight === "mated" ? "" : undefined}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 disabled:cursor-default",
        tsumeShogiToneClassNames.boardLine,
        !isLastFile && "border-r",
        !isLastRank && "border-b",
        tsumeShogiToneClassNames.focusRing,
        highlight && highlightClassNames[highlight],
      )}
    >
      {piece && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-transform duration-(--duration-fast)",
            selected && tsumeShogiToneClassNames.pieceLift,
            highlight === "mated" && tsumeShogiToneClassNames.matedPieceTilt,
          )}
        >
          <TsumeShogiPieceGlyph
            type={piece.type}
            side={piece.side}
            size="board"
            lifted={selected}
          />
        </span>
      )}
    </button>
  );
}
