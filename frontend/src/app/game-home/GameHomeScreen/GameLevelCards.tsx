import { ZukanLevelMosaic } from "@/app/game-home/GameHomeScreen/GameLevelCards/ZukanLevelMosaic";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ZukanProblemStatus } from "@/features/zukan/zukan-collection";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";

export type GameLevelCard = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 変化をまだ見せていないレベルでは前回の数。 */
  shownSolvedCount: number;
  /** そのレベルの全問を番号の順に並べる。変化をまだ見せていない問題は前回の状態。 */
  shownStatuses: readonly ZukanProblemStatus[];
  columnCount: number;
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  /** 問題のある難易度だけを、難易度の昇順に並べる。 */
  levels: readonly GameLevelCard[];
};

export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList layout="card" aria-label="レベル">
      {levels.map(
        ({
          difficulty,
          problemCount,
          shownSolvedCount,
          shownStatuses,
          columnCount,
          hasUnseenChanges,
        }) => (
          <TabsTrigger
            key={difficulty}
            value={difficulty}
            data-difficulty={difficulty}
          >
            <span className="relative block">
              <ZukanLevelMosaic
                shownStatuses={shownStatuses}
                columnCount={columnCount}
              />
              {hasUnseenChanges && (
                <span
                  aria-hidden="true"
                  data-unseen-change-mark=""
                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground ring-2 ring-background"
                />
              )}
            </span>
            <span className="flex flex-col text-meta whitespace-nowrap md:flex-row md:items-baseline md:justify-between md:gap-1">
              <span className="font-medium">
                {getDifficultyLabel(difficulty)}
              </span>
              <span className="font-normal text-muted-foreground tabular-nums">
                <span aria-hidden="true">
                  {shownSolvedCount}
                  <span className="max-[359px]:hidden">/{problemCount}</span>
                </span>
                <span className="sr-only">
                  、{problemCount}問中{shownSolvedCount}問を解いた
                </span>
                {hasUnseenChanges && (
                  <span className="sr-only">、前回から変化あり</span>
                )}
              </span>
            </span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
