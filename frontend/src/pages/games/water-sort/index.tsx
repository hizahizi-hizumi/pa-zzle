import {
  type WaterSortDifficulty,
  waterSortDifficulties,
} from "@/games/water-sort/game/difficulty";
import type { WaterSortState } from "@/games/water-sort/game/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { Link } from "@/router";

const previewStates = {
  easy: [[0, 0, 0, 1], [1, 1, 1, 0], [2, 2, 2, 3], [3, 3, 3, 2], [], []],
  normal: [[0, 0, 1, 1], [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 0, 0], [], []],
  hard: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [], []],
} satisfies Record<WaterSortDifficulty, WaterSortState>;

const previewBottleSlots = ["a", "b", "c", "d", "e", "f"] as const;

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
          <Link
            key={difficulty.id}
            to="/games/water-sort/play/:difficulty"
            params={{ difficulty: difficulty.id }}
            className="group flex min-h-36 flex-col items-center justify-center gap-4 rounded-2xl px-4 py-5 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-56 sm:gap-6 sm:py-8"
          >
            <WaterSortDifficultyPreview difficulty={difficulty.id} />
            <span className="text-lg font-semibold tracking-tight sm:text-xl">
              {difficulty.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function WaterSortDifficultyPreview({
  difficulty,
}: {
  difficulty: WaterSortDifficulty;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-16 items-end justify-center gap-2 sm:h-24 sm:gap-2.5"
    >
      {previewBottleSlots.map((slot, bottleIndex) => (
        <span key={slot} className="relative h-full aspect-[0.36]">
          <WaterBottle
            contents={previewStates[difficulty][bottleIndex] ?? []}
          />
        </span>
      ))}
    </span>
  );
}
