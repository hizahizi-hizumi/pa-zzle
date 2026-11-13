import { useTouchTap } from "@/components/touch-tap";
import {
  type ReflectionInventory,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import {
  filterReflectionCues,
  type ReflectionCue,
} from "@/games/reflection/ui/board/cue";
import { ReflectionCueLayer } from "@/games/reflection/ui/board/ReflectionCueLayer";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { reflectionPieceBarClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionStockProps = {
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  selectedBoardPiece: ReflectionPiece | null;
  disabled: boolean;
  onSelectStockPiece: (piece: ReflectionPiece) => void;
  cues?: readonly ReflectionCue[];
};

/** キーボードの数字キーもこの順に対応する。 */
export function listReflectionStockPieces(
  inventory: ReflectionInventory,
): ReflectionPiece[] {
  return reflectionPieces.filter((piece) => inventory[piece] > 0);
}

export function ReflectionStock({
  inventory,
  stock,
  selection,
  selectedBoardPiece,
  disabled,
  onSelectStockPiece,
  cues = [],
}: ReflectionStockProps) {
  const returning = !disabled && selection?.type === "cell";
  const returnTargetPiece = returning ? selectedBoardPiece : null;
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
              disabled || (remaining === 0 && piece !== returnTargetPiece)
            }
            {...getTapHandlers(() => onSelectStockPiece(piece))}
            className={cn(
              "relative flex h-11 min-w-0 max-w-16 flex-1 touch-manipulation select-none items-center justify-center text-foreground outline-none transition-[background-color,color,opacity] duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset enabled:hover:bg-accent/60 enabled:active:bg-accent disabled:opacity-40",
            )}
          >
            <ReflectionCueLayer
              cues={filterReflectionCues(cues, { type: "stock", piece })}
              place="stock"
            />
            {selected || piece === returnTargetPiece ? (
              <span
                aria-hidden="true"
                data-selection-mark={selected ? "" : undefined}
                data-return-target={selected ? undefined : ""}
                className={cn(
                  "pointer-events-none absolute inset-x-[25%] bottom-0 h-[3px]",
                  reflectionPieceBarClassNames[piece],
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
