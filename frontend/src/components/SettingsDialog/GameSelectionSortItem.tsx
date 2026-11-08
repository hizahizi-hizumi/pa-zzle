import { pointerDistance } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";

import type { GameCatalogOption } from "@/components/GameCatalogContext";
import { GamePictogram } from "@/components/GamePictogram";
import { Button } from "@/components/ui/button";
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
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon-lg"
        data-sort-handle=""
        data-game-id={game.id}
        aria-label={`${game.name}を並び替え`}
        aria-describedby="game-order-help"
        className="size-11 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-5" />
      </Button>
    </div>
  );
}
