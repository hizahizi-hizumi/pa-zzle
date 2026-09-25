import {
  assessMinesweeperDifficulty,
  isInMinesweeperDifficultyBoardRange,
  type MinesweeperDifficulty,
  minesweeperDifficulties,
} from "@/games/minesweeper/difficulty";
import {
  restoreMinesweeperProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";

const difficulties = minesweeperDifficulties.map(({ id }) => id);

// 全問の分析は1スレッドで20秒前後かかるため、テストでは等間隔に抜き出した問題だけを分析する。
// 全問の検証は `bun run generate:minesweeper-pool -- --verify` で行う。
const sampledEntryCountPerDifficulty = 50;

function listPoolIdentities(difficulty: MinesweeperDifficulty) {
  return listMinesweeperPoolEntries(difficulty).map((entry) =>
    toMinesweeperPoolIdentity(difficulty, entry),
  );
}

function sampleEvenly<T>(values: readonly T[], count: number): T[] {
  const step = Math.max(1, Math.floor(values.length / count));
  return values.filter((_, index) => index % step === 0);
}

describe("問題集", () => {
  test.each(difficulties)(
    "難易度 %s の全問題が盤面範囲に入ること",
    (difficulty) => {
      const identities = listPoolIdentities(difficulty);

      expect(identities.length).toBeGreaterThan(0);
      expect(
        identities.filter(
          ({ conditions }) =>
            !isInMinesweeperDifficultyBoardRange(difficulty, conditions),
        ),
      ).toEqual([]);
    },
  );

  test("全難易度を通して同じ盤面の問題を含まないこと", () => {
    const boardKeys = difficulties.flatMap((difficulty) =>
      listPoolIdentities(difficulty).map((identity) => {
        const { board, initialRevealedCellIndices } =
          restoreMinesweeperProblemWithoutAnalysis(identity).problem;
        return `${board.rows}x${board.columns}:${board.mineCellIndices.join(",")}:${initialRevealedCellIndices.join(",")}`;
      }),
    );

    expect(new Set(boardKeys).size).toBe(boardKeys.length);
  });

  test.each(difficulties)(
    "難易度 %s から抜き出した問題が分析でその難易度に分類されること",
    (difficulty) => {
      const assessments = sampleEvenly(
        listPoolIdentities(difficulty),
        sampledEntryCountPerDifficulty,
      ).map((identity) =>
        assessMinesweeperDifficulty(
          restoreMinesweeperProblem(identity).difficultyAnalysis,
          identity.conditions,
        ),
      );

      expect(assessments.length).toBeGreaterThanOrEqual(
        sampledEntryCountPerDifficulty,
      );
      expect(
        new Set(assessments.map((assessment) => JSON.stringify(assessment))),
      ).toEqual(
        new Set([JSON.stringify({ status: "classified", difficulty })]),
      );
    },
  );
});

describe("selectMinesweeperProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "難易度 %s で同じseedから同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectMinesweeperProblemForDifficulty(difficulty, "seed-a");
      const second = selectMinesweeperProblemForDifficulty(
        difficulty,
        "seed-a",
      );

      expect(second).toEqual(first);
    },
  );

  test.each(difficulties)(
    "難易度 %s で異なるseedから盤面範囲内の複数の問題を選ぶこと",
    (difficulty) => {
      const selected = seeds.map((seed) =>
        selectMinesweeperProblemForDifficulty(difficulty, seed),
      );

      expect(
        selected.every(
          ({ problem, identity }) =>
            problem.board.rows === identity.conditions.rows &&
            problem.board.columns === identity.conditions.columns &&
            problem.board.mineCellIndices.length ===
              identity.conditions.mineCount &&
            isInMinesweeperDifficultyBoardRange(
              difficulty,
              identity.conditions,
            ),
        ),
      ).toBe(true);
      expect(
        new Set(selected.map(({ identity }) => identity.seed)).size,
      ).toBeGreaterThan(1);
    },
  );

  test("選んだ問題に難易度分析を含めないこと", () => {
    const selected = selectMinesweeperProblemForDifficulty("1", "seed-a");

    expect(selected).not.toHaveProperty("difficultyAnalysis");
  });
});
