import { ChevronRight } from "lucide-react";

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
      <span className="relative flex items-center gap-6 rounded-xl border-(length:--border-width-normal) bg-background px-4 py-3 transition-colors group-hover:bg-accent/60 group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring lg:h-60 lg:flex-col lg:justify-center lg:px-8 lg:py-8">
        <MinesweeperDifficultyPreview difficulty={difficulty} />
        <span className="flex items-center gap-1">
          <span className="text-heading">{label}</span>
          <ChevronRight
            className="absolute right-4 size-5 text-muted-foreground transition-transform duration-(--duration-fast) ease-standard group-hover:translate-x-0.5 lg:static"
            aria-hidden="true"
          />
        </span>
      </span>
    </Link>
  );
}
