import { StartConditionOption } from "@/components/StartConditionOption";
import type { NanpureLegacyDifficulty } from "@/games/nanpure/legacy/difficulty";
import { NanpureDifficultyPreview } from "@/games/nanpure/ui/NanpureDifficultyPreview";
import { Link } from "@/router";

type NanpureDifficultyOptionProps = {
  difficulty: NanpureLegacyDifficulty;
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
