import {
  assessMinesweeperDifficulty,
  listMinesweeperDifficultyBoardConditions,
  type MinesweeperBoardSize,
  type MinesweeperDifficulty,
  minesweeperDifficulties,
  minesweeperDifficultyBoardRanges,
} from "@/games/minesweeper/difficulty";
import { restoreMinesweeperProblem } from "@/games/minesweeper/problem/generator";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";

/**
 * 難易度確認画面に載せる問題を決定的に探し、`difficulty-review-problems.ts` へ貼る形で出力する。
 * 難易度ごとに盤面サイズの定義から最小・中間・最大を1つずつ選び、そのサイズで密度範囲に入る地雷数を巡回しながら
 * 連番の seed で候補を走査し、その難易度に分類された最初の候補を採る。
 */
const PROBLEMS_PER_DIFFICULTY = 3;
const MAXIMUM_CANDIDATES = 20_000;

function pickSpreadSizes(
  sizes: readonly MinesweeperBoardSize[],
): MinesweeperBoardSize[] {
  return Array.from(
    { length: PROBLEMS_PER_DIFFICULTY },
    (_, index) =>
      sizes[
        Math.round((index * (sizes.length - 1)) / (PROBLEMS_PER_DIFFICULTY - 1))
      ]!,
  );
}

function findReviewProblem(
  difficulty: MinesweeperDifficulty,
  { rows, columns }: MinesweeperBoardSize,
): MinesweeperProblemIdentity {
  const mineCounts = listMinesweeperDifficultyBoardConditions(difficulty)
    .filter(
      (condition) => condition.rows === rows && condition.columns === columns,
    )
    .map((condition) => condition.mineCount);
  for (let index = 0; index < MAXIMUM_CANDIDATES; index += 1) {
    const identity: MinesweeperProblemIdentity = {
      generatorVersion: MINESWEEPER_GENERATOR_VERSION,
      seed: `ms-review-${difficulty}-${rows}x${columns}-${index}`,
      conditions: {
        rows,
        columns,
        mineCount: mineCounts[index % mineCounts.length]!,
        startCellPlacement: "random",
      },
      generationAttempt: 1,
    };
    const assessment = assessMinesweeperDifficulty(
      restoreMinesweeperProblem(identity).difficultyAnalysis,
      { rows, columns },
    );
    if (
      assessment.status === "classified" &&
      assessment.difficulty === difficulty
    ) {
      return identity;
    }
  }
  throw new Error(
    `No review problem for difficulty ${difficulty} on ${rows}x${columns}`,
  );
}

for (const { id: difficulty } of minesweeperDifficulties) {
  for (const size of pickSpreadSizes(
    minesweeperDifficultyBoardRanges[difficulty].sizes,
  )) {
    const { seed, conditions } = findReviewProblem(difficulty, size);
    console.log(
      `    reviewProblem("${difficulty}", "${seed}", ${conditions.rows}, ${conditions.columns}, ${conditions.mineCount}),`,
    );
  }
}
