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
        <h1 className="absolute inset-x-0 top-0 z-10 flex h-[4.5rem] items-center justify-center border-b bg-background text-screen-title sm:h-20">
          パズル選択
        </h1>
        <Link
          to={recordsTo}
          className="absolute top-0 right-3 z-20 flex h-[4.5rem] items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:h-20"
        >
          記録
        </Link>

        <Link
          to={selectedGame.to}
          aria-label={`${selectedGame.name}を遊ぶ`}
          className="flex h-full flex-col items-center justify-center transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="size-[10.625rem] p-[1.0625rem] sm:size-[14.0625rem] sm:p-[1.5625rem]">
            <GamePictogram svg={selectedGame.pictogramSvg} />
          </span>
          <span className="mt-2 text-lg font-semibold tracking-tight sm:mt-2.5 sm:text-[1.375rem]">
            {selectedGame.name}
          </span>
        </Link>
      </div>

      <nav
        aria-label="パズル一覧"
        className="min-h-0 overflow-hidden border-t bg-background pt-[1.125rem] sm:flex sm:items-center sm:px-[max(1.5rem,calc((100vw-73.75rem)/2))] sm:py-[1.375rem]"
      >
        <div className="flex w-full snap-x snap-proximity gap-2.5 overflow-x-auto px-3.5 py-0.5 [scrollbar-width:none] sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
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
                  className={`flex size-[4.875rem] items-center justify-center rounded-[0.875rem] border bg-background p-[18%] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 sm:size-[6.25rem] sm:rounded-2xl sm:p-[20%] ${
                    isSelected
                      ? "border-ring shadow-[inset_0_0_0_1px_var(--ring)]"
                      : "border-border group-hover:bg-accent"
                  }`}
                >
                  <GamePictogram svg={game.pictogramSvg} />
                </span>
                <span className="mt-1.5 w-full truncate text-center text-[10px] font-semibold leading-tight sm:mt-[0.4375rem]">
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
