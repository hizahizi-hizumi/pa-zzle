import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { solve } from "sudoku-core";

import { generateSudokuProblem } from "../src/games/sudoku/game/generator";
import { traceSudokuHumanSolve } from "../src/games/sudoku/game/human-solver";
import { isSudokuSolved } from "../src/games/sudoku/game/rules";
import type { SudokuBoard } from "../src/games/sudoku/game/state";

const clueCounts = [40, 36, 32, 28, 24] as const;
const samplesPerClue = Number.parseInt(
  process.env.SUDOKU_CORE_POC_SAMPLES_PER_CLUE ?? "50",
  10,
);

if (!Number.isInteger(samplesPerClue) || samplesPerClue < 1) {
  throw new Error("SUDOKU_CORE_POC_SAMPLES_PER_CLUE must be a positive integer");
}

type CoreStrategy = {
  title: string;
  freq: number;
};

type InvalidSample = {
  clueCount: number;
  seed: string;
  difficulty: string | null;
  score: number | null;
  board: (number | null)[];
  expectedSolution: readonly number[];
};

type ClueSummary = {
  clueCount: number;
  generated: number;
  generationFailures: number;
  humanSolved: number;
  coreClaimedSolved: number;
  coreTrustedSolved: number;
  coreAddedCoverage: number;
  coreRegressions: number;
  coreInvalidSolvedBoards: number;
  difficultyCounts: Record<string, number>;
  strategyCounts: Record<string, number>;
  solveDurationMs: {
    average: number;
    p95: number;
    max: number;
  };
};

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function matchesSolution(
  board: readonly (number | null)[],
  solution: readonly number[],
): boolean {
  return (
    board.length === solution.length &&
    board.every((value, index) => value === solution[index])
  );
}

const packageMetadata = JSON.parse(
  readFileSync("node_modules/sudoku-core/package.json", "utf8"),
) as {
  name: string;
  version: string;
};

const invalidSamples: InvalidSample[] = [];
const summaries: ClueSummary[] = [];

for (const clueCount of clueCounts) {
  let generated = 0;
  let generationFailures = 0;
  let humanSolved = 0;
  let coreClaimedSolved = 0;
  let coreTrustedSolved = 0;
  let coreAddedCoverage = 0;
  let coreRegressions = 0;
  let coreInvalidSolvedBoards = 0;
  const difficultyCounts: Record<string, number> = {};
  const strategyCounts: Record<string, number> = {};
  const solveDurations: number[] = [];

  for (let sample = 0; sample < samplesPerClue; sample += 1) {
    const seed = `sudoku-core-poc:${clueCount}:${sample}`;

    let problem;
    try {
      problem = generateSudokuProblem({
        seed,
        clueCount,
        maximumAttempts: 100,
      });
    } catch {
      generationFailures += 1;
      continue;
    }

    generated += 1;

    const humanResult = traceSudokuHumanSolve(problem.clues);
    const isHumanSolved = humanResult.status === "solved";
    if (isHumanSolved) {
      humanSolved += 1;
    }

    const startedAt = performance.now();
    const coreResult = solve([...problem.clues]);
    solveDurations.push(performance.now() - startedAt);

    if (coreResult.solved) {
      coreClaimedSolved += 1;
    }

    const analysis = coreResult.analysis;
    if (analysis?.difficulty) {
      difficultyCounts[analysis.difficulty] =
        (difficultyCounts[analysis.difficulty] ?? 0) + 1;
    } else {
      difficultyCounts.stalled = (difficultyCounts.stalled ?? 0) + 1;
    }

    for (const strategy of (analysis?.usedStrategies ?? []) as CoreStrategy[]) {
      strategyCounts[strategy.title] =
        (strategyCounts[strategy.title] ?? 0) + strategy.freq;
    }

    const solvedBoard = coreResult.board;
    const isCoreBoardValid =
      solvedBoard !== undefined &&
      isSudokuSolved(solvedBoard as SudokuBoard) &&
      matchesSolution(solvedBoard, problem.solution);

    if (isCoreBoardValid) {
      coreTrustedSolved += 1;
      if (!isHumanSolved) {
        coreAddedCoverage += 1;
      }
    } else if (isHumanSolved) {
      coreRegressions += 1;
    }

    if (coreResult.solved && !isCoreBoardValid) {
      coreInvalidSolvedBoards += 1;
      if (invalidSamples.length < 10 && solvedBoard) {
        invalidSamples.push({
          clueCount,
          seed,
          difficulty: analysis?.difficulty ?? null,
          score: analysis?.score ?? null,
          board: solvedBoard,
          expectedSolution: problem.solution,
        });
      }
    }
  }

  const totalDuration = solveDurations.reduce(
    (sum, duration) => sum + duration,
    0,
  );

  summaries.push({
    clueCount,
    generated,
    generationFailures,
    humanSolved,
    coreClaimedSolved,
    coreTrustedSolved,
    coreAddedCoverage,
    coreRegressions,
    coreInvalidSolvedBoards,
    difficultyCounts,
    strategyCounts,
    solveDurationMs: {
      average:
        solveDurations.length === 0
          ? 0
          : round(totalDuration / solveDurations.length),
      p95: round(percentile(solveDurations, 0.95)),
      max: round(Math.max(0, ...solveDurations)),
    },
  });
}

const result = {
  package: packageMetadata,
  samplesPerClue,
  totalRequested: clueCounts.length * samplesPerClue,
  summaries,
  invalidSamples,
};

mkdirSync("tmp", { recursive: true });
writeFileSync(
  "tmp/sudoku-core-poc.json",
  `${JSON.stringify(result, null, 2)}\n`,
);

console.log(JSON.stringify(result, null, 2));
