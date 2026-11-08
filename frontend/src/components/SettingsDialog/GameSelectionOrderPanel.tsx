import { GripVertical } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useGameCatalog } from "@/components/GameCatalogContext";
import { GamePictogram } from "@/components/GamePictogram";
import { useGameSelectionDrag } from "@/components/SettingsDialog/useGameSelectionDrag";
import { Button } from "@/components/ui/button";
import { gameSelectionOrderSetting } from "@/lib/game-selection-order-setting";
import { findRowShift } from "@/lib/game-selection-reordering";

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

  function reorder(gameId: string, destination: number): void {
    const remaining = orderedIds.filter((id) => id !== gameId);
    const nextOrder = [...remaining];
    nextOrder.splice(destination, 0, gameId);
    gameSelectionOrderSetting.setOrder(nextOrder);
    const gameName = gameCatalog.find(({ id }) => id === gameId)?.name;
    setAnnouncement(
      `${gameName ?? "パズル"}を${destination + 1}番目に移動しました`,
    );
  }

  const {
    listRef,
    overlayRef,
    drag,
    settling,
    handlePointerDown,
    handlePointerMove,
    finishDrag,
    cancelDrag,
    handleKeyDown,
  } = useGameSelectionDrag({ orderedIds, onReorder: reorder });

  const lifted = drag ?? settling;
  const liftedGame = gameCatalog.find(({ id }) => id === lifted?.id);

  return (
    <div className="grid gap-3">
      <div
        ref={listRef}
        role="list"
        aria-label="パズルの並び順"
        className="relative grid max-h-[calc(90dvh-11rem)] overflow-y-auto overscroll-contain"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
        onKeyDown={handleKeyDown}
      >
        {orderedIds.map((id, index) => {
          const game = gameCatalog.find((item) => item.id === id);
          if (!game) return null;
          const isSource = drag?.id === id;
          const isSettling = settling?.id === id;
          const shift = findRowShift(index, drag);
          return (
            <div
              key={id}
              role="listitem"
              data-sort-item={id}
              data-drop-placeholder={isSource ? "" : undefined}
              aria-hidden={isSource || isSettling ? true : undefined}
              className={`flex min-h-12 items-center gap-2 py-1 ${drag ? "transition-transform duration-(--duration-normal) ease-standard motion-reduce:transition-none" : ""} ${isSource ? "rounded-md border border-dashed border-ring bg-accent/25" : "border-b border-border last:border-b-0"} ${isSettling ? "opacity-0" : ""}`}
              style={
                drag
                  ? {
                      transform: `translate3d(0, ${shift}px, 0)`,
                      height: isSource ? drag.height : undefined,
                    }
                  : undefined
              }
            >
              {!isSource && (
                <>
                  {game.pictogramSvg && (
                    <span className="size-8 shrink-0 p-1">
                      <GamePictogram svg={game.pictogramSvg} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-body">
                    {game.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    data-sort-handle=""
                    data-game-id={id}
                    aria-label={`${game.name}を並び替え`}
                    aria-describedby="game-order-help"
                    className="size-11 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="size-5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <span id="game-order-help" className="sr-only">
        ドラッグして移動します。キーボードでは上下キーで一つずつ、HomeとEndで先頭と末尾へ移動できます。
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
      {lifted &&
        liftedGame &&
        createPortal(
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-md border border-border bg-popover px-2 shadow-lg"
            style={{
              left: drag ? drag.clientX - drag.grabX : settling?.targetLeft,
              top: drag ? drag.clientY - drag.grabY : settling?.targetTop,
              width: lifted.width,
              height: lifted.height,
              transform: drag ? "scale(1.018)" : undefined,
            }}
          >
            {liftedGame.pictogramSvg && (
              <span className="size-8 shrink-0 p-1">
                <GamePictogram svg={liftedGame.pictogramSvg} />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-body font-medium">
              {liftedGame.name}
            </span>
            <GripVertical className="size-5 shrink-0 text-muted-foreground" />
          </div>,
          document.body,
        )}
    </div>
  );
}
