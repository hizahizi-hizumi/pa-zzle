import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import { ZukanLevelMosaic } from "@/zukan/ui/GameHomeScreen/GameLevelCards/ZukanLevelMosaic";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";
import {
  getZukanMilestoneRatio,
  type ZukanMilestoneProgress,
} from "@/zukan/zukan-milestone";

export type GameLevelCard = {
  difficulty: DifficultyLevel;
  summary: string;
  /** 変化をまだ見せていないレベルでは、前回の解いた数から求める。 */
  shownMilestone: ZukanMilestoneProgress;
  /** そのレベルの全問を番号の順に並べる。変化をまだ見せていない問題は前回の状態。 */
  shownStatuses: readonly ZukanProblemStatus[];
  columnCount: number;
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  /** 問題のある難易度だけを、難易度の昇順に並べる。 */
  levels: readonly GameLevelCard[];
};

function formatRemaining({ solvedCount, next }: ZukanMilestoneProgress) {
  return next === null ? "全問" : `あと${next - solvedCount}問`;
}

function describeMilestone({ solvedCount, next }: ZukanMilestoneProgress) {
  return next === null
    ? `、全${solvedCount}問を解いた`
    : `、${solvedCount}問を解いた。${next}問まであと${next - solvedCount}問`;
}

export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList layout="card" aria-label="レベル">
      {levels.map(
        ({
          difficulty,
          summary,
          shownMilestone,
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
            <span className="flex flex-col text-meta whitespace-nowrap">
              <span className="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-1">
                <span className="font-medium">
                  {getDifficultyLabel(difficulty)}
                </span>
                <span className="truncate font-normal text-muted-foreground">
                  <span className="sr-only">、</span>
                  {summary}
                </span>
              </span>
              <span className="mt-0.5 flex flex-col gap-0.5 font-normal tabular-nums">
                <span aria-hidden="true">
                  {formatRemaining(shownMilestone)}
                </span>
                <span className="sr-only">
                  {describeMilestone(shownMilestone)}
                </span>
                {hasUnseenChanges && (
                  <span className="sr-only">、前回から変化あり</span>
                )}
                <span
                  aria-hidden="true"
                  data-milestone-bar=""
                  className="block h-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full origin-left rounded-full bg-foreground transition-transform duration-(--duration-slow) ease-standard motion-reduce:transition-none"
                    style={{
                      transform: `scaleX(${getZukanMilestoneRatio(shownMilestone)})`,
                    }}
                  />
                </span>
              </span>
            </span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
