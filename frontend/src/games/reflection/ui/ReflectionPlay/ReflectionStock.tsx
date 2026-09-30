import {
  type ReflectionInventory,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { reflectionPieceBarClassNames } from "@/games/reflection/ui/reflection-tone";
import { useTouchTap } from "@/games/reflection/ui/touch-tap";
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
 * 盤面のピースを選んでいる間は、そのピースと同じ種類の下に薄い線を引いて戻し先を示す（押すと戻す。別の種類を押すと置き換える）。
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
  const { getTapHandlers } = useTouchTap();

  return (
    <div
      role="group"
      aria-label={
        returning
          ? "ストック（同じ種類を押すと戻す・別の種類を押すと置き換える）"
          : "ストック"
      }
      className="relative mx-auto flex w-full max-w-md justify-center gap-1 p-1 sm:gap-1.5"
    >
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
            {...getTapHandlers(() => onTapStock(piece))}
            className={cn(
              "relative flex h-11 min-w-0 max-w-16 flex-1 touch-manipulation select-none items-center justify-center text-foreground outline-none transition-[background-color,color,opacity] duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset enabled:hover:bg-accent/60 enabled:active:bg-accent disabled:opacity-40",
            )}
          >
            {selected || piece === selectedCellPiece ? (
              <span
                aria-hidden="true"
                data-selection-mark={selected ? "" : undefined}
                data-return-target={selected ? undefined : ""}
                className={cn(
                  "pointer-events-none absolute inset-x-[25%] bottom-0 h-[3px]",
                  reflectionPieceBarClassNames[piece],
                  // 戻し先は選択の線を薄くした印にする。押すと盤面で選んだピースがこの種類へ戻る。
                  !selected && "opacity-35",
                )}
              />
            ) : null}
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
