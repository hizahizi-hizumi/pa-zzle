import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import { ZukanLevelMosaic } from "@/zukan/ui/GameHomeScreen/GameLevelCards/ZukanLevelMosaic";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

export type GameLevelCard = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 今示す解いた数。変化をまだ見せていないレベルでは前回の数を示す。 */
  solvedCount: number;
  /** そのレベルの全問の、今示す状態。番号の順。変化をまだ見せていない問題は前回の状態を示す。 */
  statuses: readonly ZukanProblemStatus[];
  columnCount: number;
  /** 変化は、前回図鑑を見たときからのもの。 */
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  /** 問題のある難易度だけを、難易度の昇順に並べる。 */
  levels: readonly GameLevelCard[];
};

/** 矢印キーで選ぶと通り過ぎたレベルの台紙を開いて変化を見せ終えるので、矢印キーではフォーカスだけを動かし、押したときと Enter・Space で選ぶ。 */
export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList layout="card" aria-label="レベル">
      {levels.map(
        ({
          difficulty,
          problemCount,
          solvedCount,
          statuses,
          columnCount,
          hasUnseenChanges,
        }) => (
          <TabsTrigger
            key={difficulty}
            value={difficulty}
            data-difficulty={difficulty}
          >
            <span className="relative block">
              <ZukanLevelMosaic statuses={statuses} columnCount={columnCount} />
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
                  {solvedCount}
                  <span className="max-[359px]:hidden">/{problemCount}</span>
                </span>
                <span className="sr-only">
                  、{problemCount}問中{solvedCount}問を解いた
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
