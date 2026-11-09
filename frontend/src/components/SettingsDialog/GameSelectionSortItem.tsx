import { pointerDistance } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";

import type { GameCatalogOption } from "@/components/GameCatalogContext";
import { GamePictogram } from "@/components/GamePictogram";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";

type GameSelectionSortItemProps = {
  game: GameCatalogOption;
  index: number;
};

export function GameSelectionSortItem({
  game,
  index,
}: GameSelectionSortItemProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: game.id,
    index,
    collisionDetector: pointerDistance,
    transition: prefersReducedMotion()
      ? null
      : {
          duration: MOTION_DURATION_MS.normal,
          easing: MOTION_EASING.standard,
          idle: true,
        },
  });

  return (
    <div
      ref={ref}
      role="listitem"
      data-sort-item={game.id}
      className={`flex min-h-12 items-center gap-2 border-b border-border py-1 last:border-b-0 ${isDragSource ? "opacity-30" : ""}`}
    >
      {game.pictogramSvg && (
        <span className="size-8 shrink-0 p-1">
          <GamePictogram svg={game.pictogramSvg} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-body">{game.name}</span>
      <button
        ref={handleRef}
        type="button"
        data-sort-handle=""
        data-game-id={game.id}
        aria-label={`${game.name}を並び替え`}
        aria-describedby="game-order-help"
        className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <GripVertical className="pointer-events-none size-5 shrink-0" />
      </button>
    </div>
  );
}
