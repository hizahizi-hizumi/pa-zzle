import { writeFileSync } from "node:fs";
import {
  assessSlidePuzzleDifficulty,
  type SlidePuzzleDifficulty,
  slidePuzzleDifficulties,
  slidePuzzleDifficultyCriteria,
} from "@/games/slide-puzzle/difficulty";
import { analyzeSlidePuzzleDifficulty } from "@/games/slide-puzzle/problem/difficulty-analysis";
import { createSlidePuzzleOptimalMoveCounter } from "@/games/slide-puzzle/problem/generation/optimal-move-count";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";
import { SLIDE_PUZZLE_GENERATOR_VERSION } from "@/games/slide-puzzle/problem/problem";
import type { SlidePuzzleProblemPoolEntry } from "@/games/slide-puzzle/problem/problem-pool";
import {
  SLIDE_PUZZLE_BOARD_SIZES,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

const outputPath = new URL(
  "../src/games/slide-puzzle/problem/problem-pool.json",
  import.meta.url,
);
/**
 * 1 問あたりの探索上限。4×4 は一様ランダムに近い盤面でも数秒で解けるので、評価不能を実質的に出さない大きさにする。
 * 5×5 は撹拌 80 手以下でも長く掛かる候補があるので、数十秒で打ち切り、評価不能として捨てる（難易度再設計調査 §4.3）。
 * 3×3 は全配置の表を引くので上限を使わない。
 */
const nodeLimitByBoardSize: Record<SlidePuzzleBoardSize, number | undefined> = {
  3: undefined,
  4: 500_000_000,
  5: 300_000_000,
};
// 別の seed から同じ盤面が出て除いた分を補うための余裕。
const duplicateAllowance = 5;

type Candidate = {
  entry: SlidePuzzleProblemPoolEntry;
  boardKey: string;
  level: SlidePuzzleDifficulty;
  detourMoveCount: number;
};

function readOption(name: string, fallback: number): number {
  const index = Bun.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(Bun.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function levelsUsing(
  boardSize: SlidePuzzleBoardSize,
  scrambleLength: number,
): SlidePuzzleDifficulty[] {
  return slidePuzzleDifficulties
    .map(({ id }) => id)
    .filter(
      (id) =>
        slidePuzzleDifficultyCriteria[id].boardSize === boardSize &&
        slidePuzzleDifficultyCriteria[id].scrambleLengths.includes(
          scrambleLength,
        ),
    );
}

function scrambleLengthsFor(boardSize: SlidePuzzleBoardSize): number[] {
  return [
    ...new Set(
      slidePuzzleDifficulties.flatMap(({ id }) =>
        slidePuzzleDifficultyCriteria[id].boardSize === boardSize
          ? slidePuzzleDifficultyCriteria[id].scrambleLengths
          : [],
      ),
    ),
  ].sort((left, right) => left - right);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function runMain() {
  const perLevel = readOption("per-level", 200);
  const budget = readOption("budget", 5000);
  const startedAt = performance.now();
  function needOf(level: SlidePuzzleDifficulty) {
    return (
      Math.ceil(
        perLevel / slidePuzzleDifficultyCriteria[level].scrambleLengths.length,
      ) + duplicateAllowance
    );
  }

  const candidatesByProfile = new Map<string, Candidate[]>();
  for (const boardSize of SLIDE_PUZZLE_BOARD_SIZES) {
    const scrambleLengths = scrambleLengthsFor(boardSize);
    if (scrambleLengths.length === 0) {
      continue;
    }
    const counterStartedAt = performance.now();
    const countOptimalMoves = createSlidePuzzleOptimalMoveCounter(boardSize, {
      nodeLimit: nodeLimitByBoardSize[boardSize],
    });
    console.error(
      `${boardSize}x${boardSize} optimal move counter: ${Math.round(performance.now() - counterStartedAt)}ms`,
    );
    for (const scrambleLength of scrambleLengths) {
      const levels = levelsUsing(boardSize, scrambleLength);
      const counts = new Map(levels.map((level) => [level, 0]));
      const profileStartedAt = performance.now();
      let unsupportedCount = 0;
      let slowestMs = 0;
      let index = 0;
      for (
        ;
        levels.some((level) => (counts.get(level) ?? 0) < needOf(level));
        index += 1
      ) {
        if (index >= budget) {
          throw new Error(
            `${boardSize}x${boardSize} scramble length ${scrambleLength} did not supply enough problems`,
          );
        }
        const seed = `sp${boardSize}-${scrambleLength}-${index}`;
        const board = generateSlidePuzzleBoard(seed, {
          size: boardSize,
          scrambleLength,
        });
        const solveStartedAt = performance.now();
        const optimalMoveCount = countOptimalMoves(board);
        slowestMs = Math.max(slowestMs, performance.now() - solveStartedAt);
        const analysis = analyzeSlidePuzzleDifficulty(board, optimalMoveCount);
        if (analysis.status !== "analyzed") {
          unsupportedCount += 1;
          continue;
        }
        const level = assessSlidePuzzleDifficulty(analysis);
        const count = level === null ? undefined : counts.get(level);
        if (level === null || count === undefined || count >= needOf(level)) {
          continue;
        }
        counts.set(level, count + 1);
        const key = `${level}:${scrambleLength}`;
        candidatesByProfile.set(key, [
          ...(candidatesByProfile.get(key) ?? []),
          {
            entry: [
              seed,
              boardSize,
              scrambleLength,
              analysis.features.optimalMoveCount,
            ],
            boardKey: board.join(","),
            level,
            detourMoveCount: analysis.features.detourMoveCount,
          },
        ]);
      }
      console.error(
        `${boardSize}x${boardSize} scramble ${scrambleLength}: ${index} candidates, ${unsupportedCount} unsupported, slowest ${Math.round(slowestMs)}ms, ${Math.round(performance.now() - profileStartedAt)}ms`,
      );
    }
  }

  const usedBoards = new Set<string>();
  const levels = Object.fromEntries(
    slidePuzzleDifficulties.map(({ id }) => {
      const perProfile = slidePuzzleDifficultyCriteria[id].scrambleLengths.map(
        (scrambleLength) =>
          candidatesByProfile.get(`${id}:${scrambleLength}`) ?? [],
      );
      const selected: Candidate[] = [];
      for (let round = 0; selected.length < perLevel; round += 1) {
        const roundCandidates = perProfile.flatMap((candidates) => {
          const candidate = candidates[round];
          return candidate ? [candidate] : [];
        });
        if (roundCandidates.length === 0) {
          throw new Error(
            `Only ${selected.length} level ${id} problems were generated`,
          );
        }
        for (const candidate of roundCandidates) {
          if (
            selected.length < perLevel &&
            !usedBoards.has(candidate.boardKey)
          ) {
            usedBoards.add(candidate.boardKey);
            selected.push(candidate);
          }
        }
      }
      return [id, selected];
    }),
  ) as Record<SlidePuzzleDifficulty, Candidate[]>;

  const lines = slidePuzzleDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map(({ entry }) => `      ${JSON.stringify(entry)}`)
        .join(",\n")}\n    ]${
        levelIndex < slidePuzzleDifficulties.length - 1 ? "," : ""
      }`,
  );
  writeFileSync(
    outputPath,
    `{\n  "generatorVersion": ${JSON.stringify(SLIDE_PUZZLE_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`,
  );

  for (const { id } of slidePuzzleDifficulties) {
    const detours = levels[id].map(({ detourMoveCount }) => detourMoveCount);
    const optimalMoveCounts = levels[id].map(({ entry }) => entry[3]);
    console.error(
      `level ${id}: ${levels[id].length} problems, detour ${Math.min(...detours)}-${Math.max(...detours)} (median ${median(detours)}), optimal ${Math.min(...optimalMoveCounts)}-${Math.max(...optimalMoveCounts)} (median ${median(optimalMoveCounts)})`,
    );
  }
  console.error(`total: ${Math.round(performance.now() - startedAt)}ms`);
}

runMain();
