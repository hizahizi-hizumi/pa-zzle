import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

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

type WaterSortDifficultyPreviewProps = {
  difficulty: WaterSortDifficulty;
};

export function WaterSortDifficultyPreview({
  difficulty,
}: WaterSortDifficultyPreviewProps) {
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
