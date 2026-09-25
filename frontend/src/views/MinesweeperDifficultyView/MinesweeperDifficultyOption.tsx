import { StartConditionOption } from "@/components/StartConditionOption";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { MinesweeperDifficultyPreview } from "@/games/minesweeper/ui/MinesweeperDifficultyPreview";
import { Link } from "@/router";

type MinesweeperDifficultyOptionProps = {
  difficulty: MinesweeperDifficulty;
  label: string;
};

export function MinesweeperDifficultyOption({
  difficulty,
  label,
}: MinesweeperDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/minesweeper/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption label={label} density="compact">
        <MinesweeperDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
