import { useEffect, useRef } from "react";
import type { CollectionGame } from "@/collection/collection";
import {
  getCollectionTowerScale,
  getCollectionTowerTiles,
} from "@/collection/ui/CollectionScreen/CollectionTowers/tower-tiles";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";

export type CollectionTowerItem = {
  game: CollectionGame;
  info: GameCatalogEntry;
};

type CollectionTowersProps = {
  items: readonly CollectionTowerItem[];
  selectedId: string;
  maxCount: number;
  onSelect: (id: string) => void;
};

/** 全ゲームの量と評価の分布。柱の上端は節目の数で、柱全体の高さで各ゲームの量を表す。 */
export function CollectionTowers({
  items,
  selectedId,
  maxCount,
  onSelect,
}: CollectionTowersProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = items.findIndex(({ game }) => game.id === selectedId);
  const scaleCount = getCollectionTowerScale(maxCount);

  useEffect(() => {
    const container = scrollRef.current;
    const selected =
      container?.querySelectorAll<HTMLElement>("[data-game-id]")[selectedIndex];
    if (!container || !selected) return;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left < container.scrollLeft) container.scrollLeft = left;
    else if (right > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = right - container.clientWidth;
    }
  }, [selectedIndex]);

  return (
    <div
      ref={scrollRef}
      role="group"
      aria-label="パズルの積み上げ"
      className="relative overflow-x-auto overscroll-x-contain rounded-lg bg-muted/30 px-2 pt-4 pb-3 sm:px-5 sm:pt-6 sm:pb-5"
    >
      <p className="mb-1 text-meta text-muted-foreground tabular-nums">
        上端 {scaleCount}問
      </p>
      <div className="relative flex w-max gap-2 sm:gap-3">
        {items.map(({ game, info }) => {
          const isSelected = selectedId === game.id;
          return (
            <button
              key={game.id}
              type="button"
              data-game-id={game.id}
              aria-label={`${info.name} ${game.total}問、Perfect ${game.counts.perfect}問。内訳を見る`}
              aria-pressed={isSelected}
              onClick={() => onSelect(game.id)}
              className={`group flex w-14 shrink-0 flex-col items-center rounded-sm px-1 pt-1 pb-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${isSelected ? "bg-background shadow-xs ring-1 ring-ring" : "hover:bg-background/70"}`}
            >
              <span
                className={`mb-1 text-[9px] font-semibold tabular-nums sm:text-xs ${game.total === 0 ? "text-muted-foreground" : ""}`}
              >
                {game.total}
              </span>
              <span
                // 行の高さを整数の px にし、小数の高さの丸めで段の間隔がばらつかないようにする。
                className="grid w-full max-w-10 grid-cols-2 grid-rows-[repeat(14,8px)] gap-0.5 border-t border-dashed border-muted-foreground pt-0.5 sm:grid-rows-[repeat(14,12px)]"
              >
                {getCollectionTowerTiles(game, scaleCount, 28).map(
                  ({ id, level }) => (
                    <span
                      key={id}
                      aria-hidden="true"
                      className={`rounded-[1px] border border-foreground/10 bg-current transition-[color,opacity] duration-(--duration-normal) ease-standard motion-reduce:transition-none sm:rounded-[2px] ${level ? `${getGameResultStyle(level).fillColorClassName} opacity-100` : "opacity-0"}`}
                    />
                  ),
                )}
              </span>
              <span className="mt-2 block size-6 shrink-0 sm:size-8">
                <GamePictogram svg={info.pictogramSvg} />
              </span>
              <span className="mt-1 hidden w-full text-center text-[10px] leading-tight text-muted-foreground sm:block">
                {info.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
