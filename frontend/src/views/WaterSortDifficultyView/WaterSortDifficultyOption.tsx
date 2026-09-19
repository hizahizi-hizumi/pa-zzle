import { StartConditionOption } from "@/components/StartConditionOption";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { WaterSortDifficultyPreview } from "@/games/water-sort/ui/WaterSortDifficultyPreview";
import { Link } from "@/router";

type WaterSortDifficultyOptionProps = {
  difficulty: WaterSortDifficulty;
  label: string;
};

export function WaterSortDifficultyOption({
  difficulty,
  label,
}: WaterSortDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/water-sort/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-2xl focus-visible:outline-none"
    >
      <StartConditionOption label={label}>
        <WaterSortDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
