import { StartConditionOption } from "@/components/StartConditionOption";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { ReflectionDifficultyPreview } from "@/games/reflection/ui/ReflectionDifficultyPreview";
import { Link } from "@/router";

type ReflectionDifficultyOptionProps = {
  difficulty: ReflectionDifficulty;
  label: string;
};

export function ReflectionDifficultyOption({
  difficulty,
  label,
}: ReflectionDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/reflection/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} density="compact">
        <ReflectionDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
