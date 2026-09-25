import { ChevronRight } from "lucide-react";

import {
  type MinesweeperDifficulty,
  type MinesweeperDifficultyAssessment,
  minesweeperDifficulties,
} from "@/games/minesweeper/difficulty";
import {
  formatMinesweeperProblemIdentitySearch,
  type MinesweeperDifficultyReviewEntry,
} from "@/games/minesweeper/difficulty-review";
import type { MinesweeperHumanSolveFeatures } from "@/games/minesweeper/problem/difficulty-analysis";
import { Link } from "@/router";

function labelOf(difficulty: MinesweeperDifficulty): string {
  return minesweeperDifficulties.find(
    (candidate) => candidate.id === difficulty,
  )!.label;
}

function formatAssessment(assessment: MinesweeperDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return labelOf(assessment.difficulty);
    case "out-of-range":
      if (assessment.reason === "outside-board-range") {
        return `提供範囲外（推論は${labelOf(assessment.inferenceDifficulty)}、盤面が範囲外）`;
      }
      return assessment.reason === "too-light"
        ? "提供範囲外（軽すぎ）"
        : "提供範囲外（重すぎ）";
    case "unsupported":
      return "評価不能";
    case "unsolvable":
      return "成立しない";
  }
}

function inferenceDifficultyOf(
  assessment: MinesweeperDifficultyAssessment,
): MinesweeperDifficulty | undefined {
  if (assessment.status === "classified") {
    return assessment.difficulty;
  }
  return assessment.status === "out-of-range" &&
    assessment.reason === "outside-board-range"
    ? assessment.inferenceDifficulty
    : undefined;
}

function describeRequiredInference(
  difficulty: MinesweeperDifficulty,
  features: MinesweeperHumanSolveFeatures,
): string {
  switch (difficulty) {
    case "1":
      return "数字1つを読むだけで最後まで進める";
    case "2":
      return `2つの数字の見比べ（包含）が${features.containmentEquivalentRoundCount}回要る`;
    case "3":
      return "2つの数字の重なりを1回読む必要がある";
    case "4":
      return [
        features.overlapEquivalentRoundCount >= 2
          ? `2つの数字の重なりを${features.overlapEquivalentRoundCount}回読む`
          : undefined,
        features.multiNumberTotalMineCountRoundCount > 0
          ? "残り地雷数を3つ以上の数字と突き合わせる"
          : undefined,
      ]
        .filter((part) => part !== undefined)
        .join("。");
    case "5":
      return `3つ以上の数字をつなげて読む連鎖が${features.chainedGroupRoundCount}回要る`;
  }
}

type DifficultyReviewRowProps = {
  entry: MinesweeperDifficultyReviewEntry;
};

export function DifficultyReviewRow({ entry }: DifficultyReviewRowProps) {
  const { difficulty, identity, assessment, features } = entry;
  const inferenceDifficulty = inferenceDifficultyOf(assessment);
  const requiredInference =
    inferenceDifficulty && features
      ? describeRequiredInference(inferenceDifficulty, features)
      : undefined;
  const { rows, columns, mineCount } = identity.conditions;
  const matchesDifficulty =
    assessment.status === "classified" && assessment.difficulty === difficulty;

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
          <span className="font-mono text-body font-semibold tabular-nums">
            {rows}×{columns}・地雷{mineCount}
          </span>
          {!matchesDifficulty && (
            <span className="text-supporting text-destructive">
              現在の判定: {formatAssessment(assessment)}
            </span>
          )}
        </span>
        {requiredInference && (
          <span className="text-supporting">{requiredInference}</span>
        )}
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
