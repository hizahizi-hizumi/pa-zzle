import { useState } from "react";
import { Link } from "react-router";

import type { Path } from "@/router";

type GameSelectionGame = {
  name: string;
  pictogramSrc: string;
  to: Path;
};

type GameSelectionGalleryProps = {
  games: readonly GameSelectionGame[];
};

export function GameSelectionGallery({ games }: GameSelectionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedGame = games[selectedIndex] ?? games[0];

  if (!selectedGame) {
    return null;
  }

  return (
    <section className="bg-background">
      <h1 className="border-b bg-background py-5 text-center text-3xl font-bold tracking-tight">
        パズル選択
      </h1>

      <Link
        to={selectedGame.to}
        aria-label={`${selectedGame.name}を遊ぶ`}
        className="flex flex-col items-center justify-center bg-muted/30 py-10 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <img
          src={selectedGame.pictogramSrc}
          alt=""
          className="size-28 sm:size-32"
        />
        <span className="mt-3 text-lg font-semibold sm:text-xl">
          {selectedGame.name}
        </span>
      </Link>

      <nav
        aria-label="パズル一覧"
        className="min-h-80 border-t bg-background pt-5 sm:flex sm:min-h-52 sm:items-center sm:pt-0"
      >
        <div className="flex w-full snap-x snap-proximity gap-2.5 overflow-x-auto px-3 [scrollbar-width:none] sm:gap-3 sm:px-6 [&::-webkit-scrollbar]:hidden">
          {games.map((game, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={game.to}
                type="button"
                aria-label={`${game.name}を選択`}
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
                className="group flex w-20 shrink-0 snap-start flex-col items-center focus-visible:outline-none sm:w-24"
              >
                <span
                  className={`flex size-20 items-center justify-center rounded-xl border bg-background p-4 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 sm:size-24 sm:p-6 ${
                    isSelected
                      ? "border-ring"
                      : "border-border group-hover:bg-accent"
                  }`}
                >
                  <img src={game.pictogramSrc} alt="" className="size-12" />
                </span>
                <span className="mt-1.5 w-full truncate text-center text-[10px] font-semibold leading-tight sm:text-xs">
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
