import { CornerLeftDown } from "lucide-react";

import {
  type ReflectionInventory,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionStockProps = {
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  /** 盤面で選んでいるマスのピース。盤面のピースを選んでいないときは `null`。 */
  selectedCell: ReflectionPiece | null;
  disabled: boolean;
  onTapStock: (piece: ReflectionPiece) => void;
};

/** 問題に含まれる種類だけを、決まった順で並べる。キーボードの数字キーもこの順に対応する。 */
export function listReflectionStockPieces(
  inventory: ReflectionInventory,
): ReflectionPiece[] {
  return reflectionPieces.filter((piece) => inventory[piece] > 0);
}

/**
 * 手持ちのピース。種類ごとのボタンを枠も影も付けずに平らに並べ、選んでいる種類だけを選択の地と枠で示す。
 * 盤面のピースを選んでいる間は、ストック全体を戻し先として地の色で示し、どの種類を押してもそのピースを戻す。
 */
export function ReflectionStock({
  inventory,
  stock,
  selection,
  selectedCell,
  disabled,
  onTapStock,
}: ReflectionStockProps) {
  const returning = !disabled && selection?.type === "cell";
  // 盤面のピースを選んでいる間、そのピースと同じ種類（押すと戻す）と、残りのある種類（押すと置き換える）を押せる。
  const selectedCellPiece = returning ? selectedCell : null;
  const pieces = listReflectionStockPieces(inventory);

  return (
    <div
      role="group"
      aria-label={returning ? "ストック（押すとストックへ戻す）" : "ストック"}
      className={cn(
        "relative mx-auto flex w-full max-w-md justify-center gap-1 p-1 transition-colors duration-(--duration-normal) sm:gap-1.5",
        returning && reflectionToneClassNames.returnTargetSurface,
      )}
    >
      {returning ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 flex h-4 -translate-x-1/2 items-center gap-1 whitespace-nowrap text-play-meta",
            reflectionToneClassNames.selectionText,
          )}
        >
          <CornerLeftDown className="size-3" />
          ここへ戻す
        </span>
      ) : null}
      {pieces.map(function renderPiece(piece) {
        const remaining = stock[piece];
        const selected =
          selection?.type === "stock" && selection.piece === piece;
        return (
          <button
            key={piece}
            type="button"
            aria-label={`${reflectionPieceLabels[piece]} 残り${remaining}`}
            aria-pressed={selected}
            disabled={
              disabled || (remaining === 0 && piece !== selectedCellPiece)
            }
            onClick={() => onTapStock(piece)}
            className={cn(
              "relative flex h-11 min-w-0 max-w-16 flex-1 touch-manipulation select-none items-center justify-center text-foreground outline-none transition-[background-color,color,opacity] duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset enabled:hover:bg-accent/60 enabled:active:bg-accent disabled:opacity-40",
              selected && reflectionToneClassNames.selectionSurface,
            )}
          >
            <ReflectionPieceIcon piece={piece} size="stock" />
            <span className="absolute right-1 bottom-0.5 font-mono text-[0.6875rem] leading-none font-semibold tabular-nums text-muted-foreground">
              {remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
