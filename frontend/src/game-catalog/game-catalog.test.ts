// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  findAttemptProblemPlayDestination,
  findRecordProblemPlayDestination,
  gameCatalog,
} from "@/game-catalog/game-catalog";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";
import type { PlayAttempt } from "@/records/play-attempt";
import { PLAY_SCORE_METRIC_ID } from "@/records/play-record-definition";
import type { ZukanProblem } from "@/zukan/zukan-collection";
import {
  collectZukanLevelFeatures,
  type ZukanFeatureOption,
} from "@/zukan/zukan-filter";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

describe("gameCatalog", () => {
  const concreteGames = readdirSync(
    fileURLToPath(new URL("../games", import.meta.url)),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  test("src/games の全ゲームを1つずつ持つこと", () => {
    const gameIds = gameCatalog.map((game) => game.id).sort();

    expect(gameIds).toEqual(concreteGames);
  });

  test("どのゲームの記録定義も、高いほど良い評価点の指標を持つこと", () => {
    const scoreMetricDirections = gameCatalog.map(
      (game) =>
        game.playRecordDisplay.definition.personalBestMetrics.find(
          (metric) => metric.id === PLAY_SCORE_METRIC_ID,
        )?.direction,
    );

    expect(scoreMetricDirections).toEqual(gameCatalog.map(() => "higher"));
  });

  test.each(gameCatalog.map((game) => [game.id, game] as const))(
    "%s が、全難易度の問題集の問題IDを重複なく返すこと",
    (_, game) => {
      const problemIds = difficultyLevels.flatMap(({ id }) =>
        game.listPoolProblemIds(id),
      );

      expect(new Set(problemIds).size).toBe(problemIds.length);
    },
  );

  test.each(gameCatalog.map((game) => [game.id, game] as const))(
    "%s が、各難易度の問題集の問題に特徴を返し、問題集に無い問題 ID には null を返すこと",
    (_, game) => {
      const featureCounts = difficultyLevels.map(({ id }) => {
        const [problemId] = game.listPoolProblemIds(id);
        return problemId === undefined
          ? 0
          : (game.describePoolProblem(id, problemId)?.length ?? 0);
      });
      const unknown = game.describePoolProblem("1", "unknown");

      expect(featureCounts.every((count) => count > 0)).toBe(true);
      expect(unknown).toBeNull();
    },
  );
});

describe("problemFeatureFilter", () => {
  /** 選択肢を、盤面は `行x列`、数は `最小-最大`（1つの値なら値）で書く。 */
  function writeOption(option: ZukanFeatureOption): string {
    if (option.kind === "board-size") {
      return `${option.rows}x${option.columns}`;
    }
    return option.min === option.max
      ? String(option.min)
      : `${option.min}-${option.max}`;
  }
  /** 問題集の1レベルの全問について、軸の名前と選択肢を求める。 */
  function listLevelFeatureOptions(
    gameId: string,
    difficulty: DifficultyLevel,
  ) {
    const game = gameCatalog.find(({ id }) => id === gameId);
    const problems = (game?.listPoolProblemIds(difficulty) ?? []).map(
      (problemId, index): ZukanProblem => ({
        kind: "unsolved",
        number: index + 1,
        difficulty,
        problemId,
        attempted: false,
      }),
    );
    const { axes } = collectZukanLevelFeatures(
      problems,
      game?.problemFeatureFilter.axes ?? [],
      (problem) =>
        game?.problemFeatureFilter.findPoolProblemValues(
          difficulty,
          problem.problemId,
        ) ?? null,
    );
    return axes.map(({ axisId, options }) => [
      game?.problemFeatureFilter.axes.find(({ id }) => id === axisId)?.display
        .label,
      options.map(writeOption),
    ]);
  }
  const cases = [
    [
      "water-sort",
      "4",
      [
        ["色", ["4", "5", "6", "8", "9", "10", "11"]],
        ["空ボトル", ["1", "2"]],
      ],
    ],
    [
      "minesweeper",
      "4",
      [
        ["盤面", ["12x10", "12x12", "14x10", "14x12", "16x12"]],
        ["地雷", ["20-24", "25-29", "30-34"]],
      ],
    ],
    [
      "parking-jam",
      "3",
      [
        ["駐車場", ["6x6", "8x6", "8x8"]],
        ["車", ["8", "11", "14"]],
        ["植え込み", ["0", "1"]],
      ],
    ],
    ["slide-puzzle", "3", []],
    ["nanpure", "3", [["初期数字", ["23", "24", "25", "26", "27"]]]],
    ["takuzu", "2", [["初期配置", ["16-17", "18-20", "21-23", "24"]]]],
    [
      "reflection",
      "4",
      [
        ["盤面", ["7x7", "8x8", "9x9"]],
        ["ピース", ["8-11", "12-15", "16-18"]],
      ],
    ],
  ] as const;

  test.each(cases)(
    "%s のレベル %s の問題集にある特徴の値から、軸ごとの選択肢を作り、8種類を超える数は幅でまとめること",
    (gameId, difficulty, expected) => {
      const options = listLevelFeatureOptions(gameId, difficulty);

      expect(options).toEqual(expected);
    },
  );
});

describe("findRecordProblemPlayDestination", () => {
  const problem = selectMinesweeperProblemForDifficulty("1", "records");
  const record = createMinesweeperPlayRecord({
    difficulty: "1",
    problemIdentity: problem.identity,
    startedAt: 1_000,
    completedAt: 121_000,
    result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
  });
  const unknownGameRecord = { ...record, gameId: "unknown-game" };

  test("記録のゲームのプレイ画面と、記録の難易度・問題IDを返すこと", () => {
    const destination = findRecordProblemPlayDestination(record);

    expect(destination).toEqual({
      playPath: "/puzzles/minesweeper/play/:difficulty",
      difficulty: "1",
      problemId: createProblemId(problem.identity),
    });
  });

  test("今のアプリに無いゲームの記録には null を返すこと", () => {
    const destination = findRecordProblemPlayDestination(unknownGameRecord);

    expect(destination).toBeNull();
  });
});

describe("findAttemptProblemPlayDestination", () => {
  const problem = selectMinesweeperProblemForDifficulty("1", "attempts");
  const attempt: PlayAttempt = {
    gameId: "minesweeper",
    startedAt: 1_000,
    start: { difficulty: "1", problemIdentity: problem.identity },
    abandonment: null,
  };
  const otherDifficultyAttempt = {
    ...attempt,
    start: { ...attempt.start, difficulty: "2" },
  };
  const unknownGameAttempt = { ...attempt, gameId: "unknown-game" };

  test("試行のゲームのプレイ画面と、試行の難易度・問題IDを返すこと", () => {
    const destination = findAttemptProblemPlayDestination(attempt);

    expect(destination).toEqual({
      playPath: "/puzzles/minesweeper/play/:difficulty",
      difficulty: "1",
      problemId: createProblemId(problem.identity),
    });
  });

  test("試行の難易度の問題集で引けない問題の試行には null を返すこと", () => {
    const destination = findAttemptProblemPlayDestination(
      otherDifficultyAttempt,
    );

    expect(destination).toBeNull();
  });

  test("今のアプリに無いゲームの試行には null を返すこと", () => {
    const destination = findAttemptProblemPlayDestination(unknownGameAttempt);

    expect(destination).toBeNull();
  });
});
