import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DifficultyLevel } from "@/games/difficulty";

export type GameLevelCard = {
  difficulty: DifficultyLevel;
  problemCount: number;
  solvedCount: number;
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  levels: readonly GameLevelCard[];
};

export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList
      variant="line"
      aria-label="レベル"
      className="grid w-full grid-cols-5 group-data-[orientation=horizontal]/tabs:h-auto gap-1 rounded-none bg-transparent p-0 lg:flex lg:flex-col lg:items-stretch lg:justify-start"
    >
      {levels.map(
        ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
          <TabsTrigger
            key={difficulty}
            value={difficulty}
            data-difficulty={difficulty}
            aria-label={`レベル ${difficulty}、${problemCount}問中${solvedCount}問を解いた${hasUnseenChanges ? "、前回から変化あり" : ""}`}
            className="relative h-14 min-w-0 flex-col gap-0.5 rounded-sm border-0 bg-transparent px-1 py-1 text-foreground/70 after:hidden hover:bg-accent/50 data-[state=active]:bg-background/70 data-[state=active]:text-foreground data-[state=active]:ring-1 data-[state=active]:ring-ring lg:h-14 lg:flex-row lg:justify-between lg:px-4"
          >
            <span className="text-lg font-semibold leading-none tabular-nums">
              <span className="sr-only">レベル </span>
              {difficulty}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground tabular-nums lg:text-meta">
              <span aria-hidden="true">
                {solvedCount}/{problemCount}
              </span>
              <span className="sr-only">
                、{problemCount}問中{solvedCount}問を解いた
              </span>
            </span>
            {hasUnseenChanges && (
              <span
                aria-hidden="true"
                data-unseen-change-mark=""
                className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground"
              />
            )}
            {hasUnseenChanges && (
              <span className="sr-only">、前回から変化あり</span>
            )}
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
