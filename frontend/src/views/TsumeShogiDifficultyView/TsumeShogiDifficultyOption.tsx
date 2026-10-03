import { StartConditionOption } from "@/components/StartConditionOption";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TsumeShogiDifficultyPreview } from "@/games/tsume-shogi/ui/TsumeShogiDifficultyPreview";
import { Link } from "@/router";

type TsumeShogiDifficultyOptionProps = {
  difficulty: TsumeShogiDifficulty;
  label: string;
};

export function TsumeShogiDifficultyOption({
  difficulty,
  label,
}: TsumeShogiDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/tsume-shogi/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} level={difficulty} density="compact">
        <TsumeShogiDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
