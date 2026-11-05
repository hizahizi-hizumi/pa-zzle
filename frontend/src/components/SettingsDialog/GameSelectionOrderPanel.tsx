import { DragDropProvider, DragOverlay, PointerSensor } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useGameCatalog } from "@/components/GameCatalogContext";
import { GamePictogram } from "@/components/GamePictogram";
import { GameSelectionSortItem } from "@/components/SettingsDialog/GameSelectionSortItem";
import { Button } from "@/components/ui/button";
import { gameSelectionOrderSetting } from "@/lib/game-selection-order-setting";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";

export function GameSelectionOrderPanel() {
  const gameCatalog = useGameCatalog();
  const defaultGameIds = gameCatalog.map(({ id }) => id);
  const preferredOrder = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getSnapshot,
    gameSelectionOrderSetting.getSnapshot,
  );
  const orderedIds = gameSelectionOrderSetting.sortGameIds(
    defaultGameIds,
    preferredOrder,
  );
  const isDefault = orderedIds.every(
    (id, index) => id === defaultGameIds[index],
  );
  const [announcement, setAnnouncement] = useState("");

  function moveGame(id: string, destination: number): void {
    const remaining = orderedIds.filter((item) => item !== id);
    const nextOrder = [...remaining];
    nextOrder.splice(destination, 0, id);
    if (nextOrder.every((item, index) => item === orderedIds[index])) return;
    gameSelectionOrderSetting.setOrder(nextOrder);
    const game = gameCatalog.find((item) => item.id === id);
    setAnnouncement(
      `${game?.name ?? "パズル"}を${destination + 1}番目に移動しました`,
    );
  }

  return (
    <div className="grid gap-3">
      <DragDropProvider
        sensors={(defaults) =>
          defaults.map((sensor) =>
            sensor === PointerSensor
              ? PointerSensor.configure({
                  activationConstraints() {
                    return undefined;
                  },
                })
              : sensor,
          )
        }
        onDragEnd={(event) => {
          if (event.canceled) return;
          const { source } = event.operation;
          if (isSortable(source) && source.index !== source.initialIndex) {
            moveGame(String(source.id), source.index);
          }
        }}
      >
        <div
          role="list"
          aria-label="パズルの並び順"
          className="grid max-h-[calc(90dvh-11rem)] overflow-y-auto overscroll-contain"
        >
          {orderedIds.map((id, index) => {
            const game = gameCatalog.find((item) => item.id === id);
            return game ? (
              <GameSelectionSortItem key={id} game={game} index={index} />
            ) : null;
          })}
        </div>
        {createPortal(
          <DragOverlay
            className="game-selection-drag-overlay"
            dropAnimation={
              prefersReducedMotion()
                ? null
                : {
                    duration: MOTION_DURATION_MS.normal,
                    easing: MOTION_EASING.standard,
                  }
            }
          >
            {(source) => {
              const game = gameCatalog.find((item) => item.id === source.id);
              if (!game) return null;
              return (
                <div className="flex h-12 items-center gap-2 rounded-md bg-popover px-2 shadow-raised">
                  {game.pictogramSvg && (
                    <span className="size-8 shrink-0 p-1">
                      <GamePictogram svg={game.pictogramSvg} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-body font-medium">
                    {game.name}
                  </span>
                  <GripVertical className="size-5 shrink-0 text-muted-foreground" />
                </div>
              );
            }}
          </DragOverlay>,
          document.body,
        )}
      </DragDropProvider>
      <span id="game-order-help" className="sr-only">
        ドラッグして移動します。キーボードではSpaceまたはEnterでつかみ、矢印キーで移動できます。
      </span>
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isDefault}
        onClick={gameSelectionOrderSetting.restoreDefault}
      >
        初期順に戻す
      </Button>
    </div>
  );
}
