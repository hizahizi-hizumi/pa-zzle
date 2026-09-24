import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

const difficultyPreviewStates = {
  "1": [[0, 1, 2, 1], [2, 0, 1, 0], [1, 2, 0, 2], []],
  "2": [[0, 2, 0, 1], [1, 0, 2, 1], [2, 1, 2, 0], [], []],
  "3": [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2], []],
  "4": [[0, 1, 2, 3], [2, 3, 0, 1], [3, 0, 1, 2], [1, 2, 3, 0], [], []],
  "5": [
    [0, 1, 2, 3],
    [4, 2, 0, 1],
    [3, 4, 1, 2],
    [1, 0, 4, 3],
    [2, 3, 4, 0],
    [],
  ],
} satisfies Record<WaterSortDifficulty, WaterSortState>;

type WaterSortDifficultyPreviewProps = {
  difficulty: WaterSortDifficulty;
};

export function WaterSortDifficultyPreview({
  difficulty,
}: WaterSortDifficultyPreviewProps) {
  const bottles = difficultyPreviewStates[difficulty].map(
    (contents, position) => ({ id: `${difficulty}-${position}`, contents }),
  );

  return (
    <span aria-hidden="true" className="relative h-12 w-32 shrink-0">
      <span className="absolute top-0 left-0 flex h-24 w-64 origin-top-left scale-50 items-end gap-2 lg:justify-center">
        {bottles.map(({ id, contents }) => (
          <span key={id} className="relative h-full aspect-[0.36]">
            <WaterBottle contents={contents} />
          </span>
        ))}
      </span>
    </span>
  );
}
