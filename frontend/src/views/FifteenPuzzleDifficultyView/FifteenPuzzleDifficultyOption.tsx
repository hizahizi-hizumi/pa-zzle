import { StartConditionOption } from "@/components/StartConditionOption";
import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { FifteenPuzzleDifficultyPreview } from "@/games/fifteen-puzzle/ui/FifteenPuzzleDifficultyPreview";
import { Link } from "@/router";

type FifteenPuzzleDifficultyOptionProps = {
  difficulty: FifteenPuzzleDifficulty;
  label: string;
};

export function FifteenPuzzleDifficultyOption({
  difficulty,
  label,
}: FifteenPuzzleDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/fifteen-puzzle/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} density="compact">
        <FifteenPuzzleDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
