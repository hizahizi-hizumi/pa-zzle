import { readFileSync, writeFileSync } from "node:fs";

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

type CoreFile = {
  package: { name: string; version: string };
  samplesPerClue: number;
  rows: CoreRatingRow[];
};

type JoinedRow = CoreRatingRow & {
  serateEr: number;
  serateEp: number;
  serateEd: number;
};

function parseSerateLine(line: string): {
  puzzle: string;
  er: number;
  ep: number;
  ed: number;
} {
  const match = line.trim().match(
    /^([0-9.]{81})\s+ED=([0-9.]+)\/([0-9.]+)\/([0-9.]+)$/,
  );
  if (!match) {
    throw new Error(`Unexpected serate output: ${line}`);
  }
  return {
    puzzle: match[1] ?? "",
    er: Number(match[2]),
    ep: Number(match[3]),
    ed: Number(match[4]),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearson(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length < 2) {
    return Number.NaN;
  }
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquare += leftDelta * leftDelta;
    rightSquare += rightDelta * rightDelta;
  }
  return numerator / Math.sqrt(leftSquare * rightSquare);
}

function ranks(values: readonly number[]): number[] {
  const entries = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const result = new Array<number>(values.length);

  let start = 0;
  while (start < entries.length) {
    let end = start + 1;
    while (end < entries.length && entries[end]?.value === entries[start]?.value) {
      end += 1;
    }
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      const originalIndex = entries[index]?.index;
      if (originalIndex !== undefined) {
        result[originalIndex] = averageRank;
      }
    }
    start = end;
  }

  return result;
}

function spearman(left: readonly number[], right: readonly number[]): number {
  return pearson(ranks(left), ranks(right));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index] ?? Number.NaN;
}

function isSinglesOnly(row: CoreRatingRow): boolean {
  return row.strategyUsage.every((strategy) =>
    [
      "Open Singles Strategy",
      "Visual Elimination Strategy",
      "Single Candidate Strategy",
    ].includes(strategy.title),
  );
}

const core = JSON.parse(
  readFileSync("tmp/rating-comparison/core.json", "utf8"),
) as CoreFile;
const serateLines = readFileSync(
  "tmp/rating-comparison/serate.txt",
  "utf8",
)
  .split(/\r?\n/)
  .filter(Boolean);
const serateRows = serateLines.map(parseSerateLine);

if (core.rows.length !== serateRows.length) {
  throw new Error(
    `Row count mismatch: core=${core.rows.length}, serate=${serateRows.length}`,
  );
}

const joined: JoinedRow[] = core.rows.map((row, index) => {
  const serate = serateRows[index];
  if (!serate || serate.puzzle !== row.puzzle) {
    throw new Error(`Puzzle order mismatch at row ${index}`);
  }
  return {
    ...row,
    serateEr: serate.er,
    serateEp: serate.ep,
    serateEd: serate.ed,
  };
});

const ratedByCore = joined.filter(
  (row): row is JoinedRow & { score: number; difficulty: string } =>
    row.score !== null && row.difficulty !== null,
);
const scoreMismatches = ratedByCore.filter(
  (row) => Math.abs(row.score - row.scoreFromReportedStrategies) > 0.001,
);
const singlesOnly = ratedByCore.filter(isSinglesOnly);
const advanced = ratedByCore.filter((row) => !isSinglesOnly(row));

const byDifficulty = Object.fromEntries(
  [...new Set(ratedByCore.map((row) => row.difficulty))].map((difficulty) => {
    const rows = ratedByCore.filter((row) => row.difficulty === difficulty);
    const erValues = rows.map((row) => row.serateEr);
    return [
      difficulty,
      {
        count: rows.length,
        serateEr: {
          min: Math.min(...erValues),
          p25: percentile(erValues, 0.25),
          median: percentile(erValues, 0.5),
          p75: percentile(erValues, 0.75),
          max: Math.max(...erValues),
        },
      },
    ];
  }),
);

const result = {
  package: core.package,
  sampleCount: joined.length,
  coreRatedCount: ratedByCore.length,
  serateRatedCount: serateRows.length,
  scoreConsistency: {
    mismatchCount: scoreMismatches.length,
    mismatchRate: round(scoreMismatches.length / ratedByCore.length),
    examples: scoreMismatches.slice(0, 10).map((row) => ({
      id: row.id,
      difficulty: row.difficulty,
      score: row.score,
      scoreFromReportedStrategies: row.scoreFromReportedStrategies,
      strategyUsage: row.strategyUsage,
      serateEr: row.serateEr,
    })),
  },
  correlations: {
    coreScoreVsSerateEr: {
      pearson: round(
        pearson(
          ratedByCore.map((row) => row.score),
          ratedByCore.map((row) => row.serateEr),
        ),
      ),
      spearman: round(
        spearman(
          ratedByCore.map((row) => row.score),
          ratedByCore.map((row) => row.serateEr),
        ),
      ),
      count: ratedByCore.length,
    },
    clueCountVsSerateEr: {
      pearson: round(
        pearson(
          joined.map((row) => -row.clueCount),
          joined.map((row) => row.serateEr),
        ),
      ),
      spearman: round(
        spearman(
          joined.map((row) => -row.clueCount),
          joined.map((row) => row.serateEr),
        ),
      ),
      count: joined.length,
    },
    singlesOnlyCoreScoreVsSerateEr: {
      pearson: round(
        pearson(
          singlesOnly.map((row) => row.score),
          singlesOnly.map((row) => row.serateEr),
        ),
      ),
      spearman: round(
        spearman(
          singlesOnly.map((row) => row.score),
          singlesOnly.map((row) => row.serateEr),
        ),
      ),
      count: singlesOnly.length,
    },
    advancedCoreScoreVsSerateEr: {
      pearson: round(
        pearson(
          advanced.map((row) => row.score),
          advanced.map((row) => row.serateEr),
        ),
      ),
      spearman: round(
        spearman(
          advanced.map((row) => row.score),
          advanced.map((row) => row.serateEr),
        ),
      ),
      count: advanced.length,
    },
  },
  byDifficulty,
};

writeFileSync(
  "tmp/rating-comparison/comparison.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
