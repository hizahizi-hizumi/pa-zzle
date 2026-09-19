import { ChevronRight } from "lucide-react";

import {
  type WaterSortDifficulty,
  waterSortDifficulties,
} from "@/games/water-sort/difficulty";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { Link } from "@/router";

const difficultyPreviewStates = {
  easy: [
    [1, 0, 0, 3],
    [3, 2, 1, 3],
    [2, 2, 1, 0],
    [2, 3, 1, 0],
  ],
  normal: [
    [2, 4, 4, 1],
    [0, 3, 4, 0],
    [2, 1, 3, 3],
    [4, 1, 2, 1],
    [0, 3, 2, 0],
  ],
  hard: [
    [2, 2, 0, 1],
    [0, 3, 1, 5],
    [3, 4, 1, 4],
    [2, 5, 0, 4],
    [0, 1, 5, 5],
    [2, 4, 3, 3],
  ],
} satisfies Record<WaterSortDifficulty, WaterSortState>;

export default function WaterSortDifficultyPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">ウォーターソート</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {waterSortDifficulties.map((difficulty) => (
          <WaterSortDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}

function WaterSortDifficultyOption({
  difficulty,
  label,
}: {
  difficulty: WaterSortDifficulty;
  label: string;
}) {
  return (
    <Link
      to="/games/water-sort/play/:difficulty"
      params={{ difficulty }}
      className="group relative flex min-h-36 flex-col items-center justify-center gap-4 rounded-2xl border bg-background px-10 py-5 transition-colors hover:bg-accent/60 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-56 sm:gap-6 sm:py-8"
    >
      <WaterSortDifficultyPreview difficulty={difficulty} />
      <span className="text-lg font-semibold tracking-tight sm:text-xl">
        {label}
      </span>
      <ChevronRight
        className="absolute right-4 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function WaterSortDifficultyPreview({
  difficulty,
}: {
  difficulty: WaterSortDifficulty;
}) {
  const previewState = difficultyPreviewStates[difficulty];

  return (
    <span
      aria-hidden="true"
      className="flex h-16 items-end justify-center gap-2 sm:h-24 sm:gap-2.5"
    >
      {previewState.map((contents) => (
        <span
          key={[difficulty, ...contents].join("-")}
          className="relative h-full aspect-[0.36]"
        >
          <WaterBottle contents={contents} />
        </span>
      ))}
    </span>
  );
}
