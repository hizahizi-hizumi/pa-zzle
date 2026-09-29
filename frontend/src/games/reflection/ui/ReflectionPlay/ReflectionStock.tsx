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
 * 手持ちのピース。
 * 盤面のピースを選んでいる間は、ストック全体を戻し先として枠で囲み、どの種類を押してもそのピースを戻す。
 */
export function ReflectionStock({
  inventory,
  stock,
  selection,
  disabled,
  onTapStock,
}: ReflectionStockProps) {
  const returning = !disabled && selection?.type === "cell";
  const pieces = listReflectionStockPieces(inventory);

  return (
    <div
      role="group"
      aria-label={returning ? "ストック（押すとストックへ戻す）" : "ストック"}
      className={cn(
        "relative mx-auto flex w-full max-w-md justify-center gap-1 rounded-lg sm:gap-1.5 border-(length:--border-width-strong) border-dashed border-transparent p-1 transition-colors duration-(--duration-normal)",
        returning && reflectionToneClassNames.selectionBorder,
      )}
    >
      {returning ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-2 left-1/2 z-10 flex h-4 -translate-x-1/2 items-center gap-1 whitespace-nowrap bg-background px-2 text-play-meta",
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
            disabled={disabled || (!returning && remaining === 0)}
            onClick={() => onTapStock(piece)}
            className={cn(
              "relative flex h-11 min-w-0 max-w-16 flex-1 touch-manipulation select-none items-center justify-center rounded-md border-(length:--border-width-normal) bg-background text-foreground shadow-raised outline-none transition-[background-color,color,opacity] duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-accent/60 enabled:active:bg-accent disabled:opacity-40 disabled:shadow-none",
              selected && reflectionToneClassNames.selectionSurface,
              selected && reflectionToneClassNames.selectionText,
              returning && "border-dashed",
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
