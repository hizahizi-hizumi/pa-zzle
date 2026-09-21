import { useState } from "react";
import { Link } from "react-router";

import { GamePictogram } from "@/components/GamePictogram";
import type { Path } from "@/router";

type GameSelectionGame = {
  name: string;
  pictogramSvg: string;
  to: Path;
};

type GameSelectionGalleryProps = {
  games: readonly GameSelectionGame[];
  recordsTo: Path;
};

export function GameSelectionGallery({
  games,
  recordsTo,
}: GameSelectionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedGame = games[selectedIndex] ?? games[0];

  if (!selectedGame) {
    return null;
  }

  return (
    <section className="grid min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] grid-rows-[29.375rem_minmax(0,1fr)] bg-background sm:grid-rows-[minmax(0,1fr)_14.375rem]">
      <div className="relative min-h-0 bg-muted/30">
        <h1 className="absolute inset-x-0 top-0 z-10 flex h-[4.5rem] items-center justify-center border-b-(length:--border-width-normal) bg-background text-screen-title sm:h-20">
          パズル選択
        </h1>
        <Link
          to={recordsTo}
          className="absolute top-0 right-3 z-20 flex h-[4.5rem] items-center px-2 text-supporting font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:h-20"
        >
          記録
        </Link>

        <Link
          to={selectedGame.to}
          aria-label={`${selectedGame.name}を遊ぶ`}
          className="flex h-full flex-col items-center justify-center transition-colors duration-(--duration-slow) hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="size-[10.625rem] p-4 sm:size-[14.0625rem] sm:p-6">
            <GamePictogram svg={selectedGame.pictogramSvg} />
          </span>
          <span className="mt-2 text-heading sm:mt-3">{selectedGame.name}</span>
        </Link>
      </div>

      <nav
        aria-label="パズル一覧"
        className="min-h-0 overflow-hidden border-t-(length:--border-width-normal) bg-background pt-4 sm:flex sm:items-center sm:px-[max(calc(var(--spacing)*6),calc((100vw-73.75rem)/2))] sm:py-6"
      >
        <div className="flex w-full snap-x snap-proximity gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {games.map((game, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={game.to}
                type="button"
                aria-label={`${game.name}を選択`}
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
                className="group flex w-[4.875rem] shrink-0 snap-start flex-col items-center focus-visible:outline-none sm:w-[6.25rem]"
              >
                <span
                  className={`flex size-[4.875rem] items-center justify-center rounded-xl bg-background p-[18%] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 sm:size-[6.25rem] sm:rounded-xl sm:p-[20%] ${
                    isSelected
                      ? "border-(length:--border-width-strong) border-ring"
                      : "border-(length:--border-width-normal) border-border group-hover:bg-accent"
                  }`}
                >
                  <GamePictogram svg={game.pictogramSvg} />
                </span>
                <span className="mt-2 w-full truncate text-center text-meta font-semibold sm:mt-2">
                  {game.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
