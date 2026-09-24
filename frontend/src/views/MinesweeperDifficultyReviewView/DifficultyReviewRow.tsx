import { ChevronRight } from "lucide-react";

import {
  type MinesweeperDifficultyAssessment,
  minesweeperDifficulties,
} from "@/games/minesweeper/difficulty";
import {
  formatMinesweeperProblemIdentitySearch,
  type MinesweeperDifficultyReviewEntry,
} from "@/games/minesweeper/difficulty-review";
import { Link } from "@/router";

function formatAssessment(assessment: MinesweeperDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return minesweeperDifficulties.find(
        (difficulty) => difficulty.id === assessment.difficulty,
      )!.label;
    case "out-of-range":
      return assessment.reason === "too-light"
        ? "提供範囲外（軽すぎ）"
        : "提供範囲外（重すぎ）";
    case "unsupported":
      return "評価不能";
    case "unsolvable":
      return "成立しない";
  }
}

type DifficultyReviewRowProps = {
  entry: MinesweeperDifficultyReviewEntry;
};

export function DifficultyReviewRow({ entry }: DifficultyReviewRowProps) {
  const { identity, assessment, description } = entry;
  const { rows, columns, mineCount } = identity.conditions;

  return (
    <Link
      to={{
        pathname: "/puzzles/minesweeper/difficulty-review/play",
        search: formatMinesweeperProblemIdentitySearch(identity),
      }}
      className="group flex items-center gap-3 border-b-(length:--border-width-normal) py-3 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-body font-semibold">
            {formatAssessment(assessment)}
          </span>
          <span className="font-mono text-supporting tabular-nums text-muted-foreground">
            {rows}×{columns}・地雷{mineCount}
          </span>
        </span>
        <span className="text-supporting">{description}</span>
        <span className="truncate font-mono text-meta text-muted-foreground">
          {identity.seed}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) ease-standard group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
