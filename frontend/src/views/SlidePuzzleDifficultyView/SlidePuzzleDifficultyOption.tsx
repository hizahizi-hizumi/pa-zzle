import { StartConditionOption } from "@/components/StartConditionOption";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { SlidePuzzleDifficultyPreview } from "@/games/slide-puzzle/ui/SlidePuzzleDifficultyPreview";
import { Link } from "@/router";

type SlidePuzzleDifficultyOptionProps = {
  difficulty: SlidePuzzleDifficulty;
  label: string;
};

export function SlidePuzzleDifficultyOption({
  difficulty,
  label,
}: SlidePuzzleDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/slide-puzzle/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} density="compact">
        <SlidePuzzleDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
