import {
  type ReflectionInventory,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";

type ReflectionStockProps = {
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  disabled: boolean;
  onTapStock: (piece: ReflectionPiece) => void;
};

/**
 * 手持ちのピース。問題に含まれる種類だけを並べる。
 * 盤面のピースを選んでいる間は、どの種類を押してもそのピースをストックへ戻す。
 */
export function ReflectionStock({
  inventory,
  stock,
  selection,
  disabled,
  onTapStock,
}: ReflectionStockProps) {
  const returning = selection?.type === "cell";
  const pieces = reflectionPieces.filter((piece) => inventory[piece] > 0);

  return (
    <div
      role="group"
      aria-label={returning ? "ストック（押すとストックへ戻す）" : "ストック"}
      className="flex flex-wrap justify-center gap-2"
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
            disabled={disabled || (!returning && remaining === 0)}
            onClick={() => onTapStock(piece)}
            className="flex h-12 min-w-14 touch-manipulation select-none items-center gap-1 rounded-md border border-border bg-background px-2 text-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-40 aria-pressed:border-violet-600 aria-pressed:bg-violet-100 dark:aria-pressed:border-violet-400 dark:aria-pressed:bg-violet-950/70"
          >
            <ReflectionPieceIcon piece={piece} size="stock" />
            <span className="font-mono text-sm tabular-nums">{remaining}</span>
          </button>
        );
      })}
    </div>
  );
}
