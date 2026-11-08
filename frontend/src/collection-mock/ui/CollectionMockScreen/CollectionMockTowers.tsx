import {
  type CollectionMockGame,
  getMockTowerTiles,
} from "@/collection-mock/model";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";

type CollectionMockTowersProps = {
  games: readonly CollectionMockGame[];
  catalog: readonly GameCatalogEntry[];
  selectedId: string;
  maxCount: number;
  onSelect: (id: string) => void;
};

/** 全ゲームの量と評価の分布。1片は一定数の問題ではなく、柱全体で各ゲームの量を表す。 */
export function CollectionMockTowers({
  games,
  catalog,
  selectedId,
  maxCount,
  onSelect,
}: CollectionMockTowersProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-muted/35 px-2 pt-3 pb-2 sm:px-5 sm:pt-5 sm:pb-4">
      <div
        className="pointer-events-none absolute inset-x-3 top-8 bottom-[3.25rem] flex flex-col justify-between sm:inset-x-5 sm:top-10 sm:bottom-[4.25rem]"
        aria-hidden="true"
      >
        {["a", "b", "c", "d"].map((line) => (
          <div
            key={line}
            className="border-t border-dashed border-foreground/10"
          />
        ))}
      </div>
      <div className="relative grid grid-cols-10 gap-0.5 sm:gap-2">
        {games.map((game, index) => {
          const info = catalog[index];
          if (!info) return null;
          const isSelected = selectedId === game.id;
          return (
            <button
              key={game.id}
              type="button"
              aria-label={`${info.name} ${game.total}問、Perfect ${game.counts.perfect}問。内訳を見る`}
              aria-pressed={isSelected}
              onClick={() => onSelect(game.id)}
              className={`group flex min-w-0 flex-col items-center rounded-sm px-px pt-1 pb-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${isSelected ? "bg-background shadow-xs ring-1 ring-ring" : "hover:bg-background/70"}`}
            >
              <span
                className={`mb-1 text-[9px] font-semibold tabular-nums sm:text-xs ${game.total === 0 ? "text-muted-foreground" : ""}`}
              >
                {game.total}
              </span>
              <span className="grid h-36 w-full max-w-9 grid-cols-2 grid-rows-14 gap-[1.5px] sm:h-52 sm:gap-[2px]">
                {getMockTowerTiles(game, maxCount, 28).map(({ id, level }) => (
                  <span
                    key={id}
                    aria-hidden="true"
                    className={
                      level
                        ? `rounded-[1px] border border-foreground/10 bg-current transition-colors duration-(--duration-normal) ease-standard sm:rounded-[2px] ${getGameResultStyle(level).fillColorClassName}`
                        : "bg-transparent"
                    }
                  />
                ))}
              </span>
              <span className="mt-2 block size-5 shrink-0 sm:size-8">
                <GamePictogram svg={info.pictogramSvg} />
              </span>
              <span className="mt-1 hidden w-full truncate text-center text-[10px] text-muted-foreground sm:block">
                {info.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
