import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { solve } from "sudoku-core";

import { generateSudokuProblem } from "../src/games/sudoku/game/generator";

const clueCounts = [40, 36, 32, 28, 24] as const;
const samplesPerClue = Number.parseInt(
  process.env.SUDOKU_RATING_SAMPLES_PER_CLUE ?? "25",
  10,
);

if (!Number.isInteger(samplesPerClue) || samplesPerClue < 1) {
  throw new Error("SUDOKU_RATING_SAMPLES_PER_CLUE must be a positive integer");
}

const strategyWeights: Record<string, number> = {
  "Open Singles Strategy": 0.1,
  "Visual Elimination Strategy": 9,
  "Single Candidate Strategy": 8,
  "Naked Pair Strategy": 50,
  "Pointing Elimination Strategy": 80,
  "Hidden Pair Strategy": 90,
};

type StrategyUsage = {
  title: string;
  freq: number;
};

type CoreRatingRow = {
  id: string;
  clueCount: number;
  seed: string;
  puzzle: string;
  difficulty: string | null;
  score: number | null;
  scoreFromReportedStrategies: number;
  strategyUsage: StrategyUsage[];
};

function serializePuzzle(board: readonly (number | null)[]): string {
  return board.map((value) => value ?? ".").join("");
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

const packageMetadata = JSON.parse(
  readFileSync("node_modules/sudoku-core/package.json", "utf8"),
) as {
  name: string;
  version: string;
};

const rows: CoreRatingRow[] = [];

for (const clueCount of clueCounts) {
  for (let sample = 0; sample < samplesPerClue; sample += 1) {
    const id = `${clueCount}-${sample}`;
    const seed = `sudoku-rating-comparison:${id}`;
    const problem = generateSudokuProblem({
      seed,
      clueCount,
      maximumAttempts: 100,
    });
    const result = solve([...problem.clues]);
    const strategyUsage = (result.analysis?.usedStrategies ?? []).map(
      (strategy) => ({
        title: strategy?.title ?? "unknown",
        freq: strategy?.freq ?? 0,
      }),
    );
    const scoreFromReportedStrategies = roundScore(
      strategyUsage.reduce(
        (sum, strategy) =>
          sum + (strategyWeights[strategy.title] ?? 0) * strategy.freq,
        0,
      ),
    );

    rows.push({
      id,
      clueCount,
      seed,
      puzzle: serializePuzzle(problem.clues),
      difficulty: result.analysis?.difficulty ?? null,
      score: result.analysis?.score ?? null,
      scoreFromReportedStrategies,
      strategyUsage,
    });
  }
}

mkdirSync("tmp/rating-comparison", { recursive: true });
writeFileSync(
  "tmp/rating-comparison/core.json",
  `${JSON.stringify(
    {
      package: packageMetadata,
      samplesPerClue,
      rows,
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  "tmp/rating-comparison/puzzles.txt",
  `${rows.map((row) => row.puzzle).join("\n")}\n`,
);

console.log(
  JSON.stringify({
    package: packageMetadata,
    sampleCount: rows.length,
    output: "tmp/rating-comparison",
  }),
);
