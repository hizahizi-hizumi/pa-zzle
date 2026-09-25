import { StartConditionOption } from "@/components/StartConditionOption";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { TakuzuDifficultyPreview } from "@/games/takuzu/ui/TakuzuDifficultyPreview";
import { Link } from "@/router";

type TakuzuDifficultyOptionProps = {
  difficulty: TakuzuDifficulty;
  label: string;
};

export function TakuzuDifficultyOption({
  difficulty,
  label,
}: TakuzuDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/takuzu/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} density="comfortable">
        <TakuzuDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
