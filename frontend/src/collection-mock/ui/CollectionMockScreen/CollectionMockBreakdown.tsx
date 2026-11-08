import { ArrowUpRight } from "lucide-react";
import type { CollectionMockGame } from "@/collection-mock/model";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import { Button } from "@/components/ui/button";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import type { GameResultLevel } from "@/games/result";
import { Link } from "@/router";

const levels: readonly GameResultLevel[] = [
  "perfect",
  "great",
  "good",
  "clear",
];

type CollectionMockBreakdownProps = {
  game: CollectionMockGame;
  info: GameCatalogEntry;
};

/** 選んだゲームを難易度と最高評価の2軸で確認する。データはコレクション全体と同じスナップショット。 */
export function CollectionMockBreakdown({
  game,
  info,
}: CollectionMockBreakdownProps) {
  const max = Math.max(1, ...game.difficulties.map(({ total }) => total));
  return (
    <section
      aria-label={`${info.name}の内訳`}
      className="mt-5 rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="block size-10 shrink-0 rounded-md bg-muted/40 p-1.5">
            <GamePictogram svg={info.pictogramSvg} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{info.name}</h3>
            <p className="text-meta text-muted-foreground">
              {game.total}問 · Perfect {game.counts.perfect}問
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={info.homePath}>
            図鑑へ <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <h4 className="mb-3 text-supporting font-medium">レベル別の内訳</h4>
        <div className="grid gap-3">
          {game.difficulties.map((difficulty) => (
            <div
              key={difficulty.level}
              className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-3 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]"
            >
              <span className="text-xs font-medium text-muted-foreground">
                Lv{difficulty.level}
              </span>
              <div className="flex h-3 items-center">
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
    </section>
  );
}
