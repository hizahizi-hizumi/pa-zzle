import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import { Button } from "@/components/ui/button";
import type { CollectionGame } from "@/features/collection/collection";
import { gameResultLevelsAscending } from "@/games/result";
import { Link } from "@/router";

const levels = [...gameResultLevelsAscending].reverse();

type CollectionBreakdownProps = {
  game: CollectionGame;
  info: GameCatalogEntry;
};

export function CollectionBreakdown({ game, info }: CollectionBreakdownProps) {
  const [showLevels, setShowLevels] = useState(false);
  const max = Math.max(1, ...game.difficulties.map(({ total }) => total));

  return (
    <section
      aria-label={`${info.name}の内訳`}
      className="mt-5 border-b border-border pb-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="block size-9 shrink-0">
            <GamePictogram svg={info.pictogramSvg} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug">{info.name}</h3>
            <p className="mt-0.5 text-meta text-muted-foreground tabular-nums">
              {game.total}問
            </p>
          </div>
        </div>
        {info.homePath && (
          <Button asChild size="sm" variant="ghost">
            <Link to={info.homePath}>
              ゲームへ <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
      <div
        className="mt-4 grid grid-cols-4 gap-2"
        aria-label={`${info.name}の最高評価別の問題数`}
      >
        {levels.map((level) => (
          <div key={level} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 shrink-0 rounded-[2px] bg-current ${getGameResultStyle(level).fillColorClassName}`}
                aria-hidden="true"
              />
              <span className="font-semibold tabular-nums">
                {game.counts[level].toLocaleString("ja-JP")}
              </span>
            </div>
            <span className="text-meta text-muted-foreground capitalize">
              {level}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={showLevels}
          aria-controls="collection-levels"
          onClick={() => setShowLevels((current) => !current)}
        >
          レベル別
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform duration-(--duration-normal) ease-standard motion-reduce:transition-none ${showLevels ? "rotate-180" : ""}`}
          />
        </Button>
      </div>
      {showLevels && (
        <div id="collection-levels" className="mt-4">
          <div className="grid gap-4">
            {game.difficulties.map((difficulty) => (
              <div
                key={difficulty.level}
                className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-3 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Lv{difficulty.level}
                </span>
                <div className="flex h-2.5 items-center">
                  <div
                    className="flex h-full min-w-0 overflow-hidden rounded-[2px] bg-muted"
                    style={{ width: `${(difficulty.total / max) * 100}%` }}
                    role="img"
                    aria-label={`レベル${difficulty.level}: ${difficulty.total}問、Perfect ${difficulty.counts.perfect}問`}
                  >
                    {levels.map((level) => (
                      <span
                        key={level}
                        className={`h-full shrink-0 bg-current ${getGameResultStyle(level).fillColorClassName}`}
                        style={{
                          width: `${difficulty.total ? (difficulty.counts[level] / difficulty.total) * 100 : 0}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-right text-xs font-semibold tabular-nums">
                  {difficulty.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
