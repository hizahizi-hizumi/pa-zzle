import { StartConditionOption } from "@/components/StartConditionOption";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { NanpureDifficultyPreview } from "@/games/nanpure/ui/NanpureDifficultyPreview";
import { Link } from "@/router";

type NanpureDifficultyOptionProps = {
  difficulty: NanpureDifficulty;
  label: string;
};

export function NanpureDifficultyOption({
  difficulty,
  label,
}: NanpureDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/nanpure/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label}>
        <NanpureDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
