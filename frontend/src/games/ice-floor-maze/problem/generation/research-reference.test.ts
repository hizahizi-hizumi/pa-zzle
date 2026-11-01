// @vitest-environment node

import {
  classifyLooksReading,
  createElementContext,
  measureElementMetrics,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import {
  type ElementRecipe,
  _private as elementObjective,
  listElementViolations,
  scoreElementHardness,
} from "@/games/ice-floor-maze/problem/generation/element-objective";
import { markOutsideCells } from "@/games/ice-floor-maze/problem/generation/outside-cells";
import { measureStateReadingDepth } from "@/games/ice-floor-maze/problem/generation/reading-model";
import reference from "@/games/ice-floor-maze/problem/generation/research-reference.json";
import {
  createElementRules,
  exploreStateSpace,
  _private as stateSpace,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import {
  countNearPaths,
  createStaticBoardGraph,
  createStaticStopper,
  listStaticTacticTags,
  MAXIMUM_READING_DEPTH,
  measureStaticReadingDepth,
  measureStaticTactics,
  type StaticTacticTag,
} from "@/games/ice-floor-maze/problem/generation/static-tactics";
import {
  createTacticWeights,
  _private as tacticSearch,
} from "@/games/ice-floor-maze/problem/generation/tactic-search";

const { evaluateElementContext, scoreElementProblem } = elementObjective;
const { formatGenerationBoardRows, parseGenerationBoardRows } = stateSpace;
const { defaultTacticWeights, evaluateTacticBoard, scoreTactics } =
  tacticSearch;

// 期待値は scripts/research/ice_floor_generation_port_reference.py が研究用の生成 v2・v4 から書き出した値。

const [v4Shortest, v4ElementsMinimum, v4ElementsMaximum] = [
  reference.v4.recipe.shortest,
  reference.v4.recipe.elements[0]!,
  reference.v4.recipe.elements[1]!,
];
const v4Recipe: ElementRecipe = {
  variant: "mixed",
  width: 10,
  height: 10,
  shortest: { minimum: v4Shortest[0]!, maximum: v4Shortest[1]! },
  elements: { minimum: v4ElementsMinimum, maximum: v4ElementsMaximum },
  minimumEach: reference.v4.recipe.minimumEach,
  minimumUses: 3,
  decoyShare: 0.2,
  forcedShare: 0.25,
  maximumRockDensity: 0.3,
};

type ElementEntry = {
  rows: readonly string[];
  start: number;
  goal: number;
};
type OutsideEntry = (typeof reference.v4.boards)[number]["outside"];

/** 研究用の置き換えは横長の盤面を残すが、こちらは縦横を入れ替えて縦長にする。 */
function toPortrait(outside: OutsideEntry): OutsideEntry {
  const { width, rows, start, goal } = outside;
  const height = rows.length;
  if (width <= height) {
    return outside;
  }
  function transposeCell(cell: number): number {
    return (cell % width) * height + Math.floor(cell / width);
  }
  return {
    width: height,
    rows: Array.from({ length: width }, (_, x) =>
      rows.map((row) => row[x]).join(""),
    ),
    start: transposeCell(start),
    goal: transposeCell(goal),
  };
}

function measureElementEntry(entry: ElementEntry) {
  const board = parseGenerationBoardRows(entry.rows);
  const context = createElementContext(board, entry.start);
  const metrics = measureElementMetrics(context, entry.goal)!;
  const space = exploreStateSpace(createElementRules(board), entry.start, {
    goal: entry.goal,
  })!;
  return {
    ...metrics,
    looksReading: classifyLooksReading(metrics),
    hardness: Number(scoreElementHardness(metrics).toFixed(6)),
    score: Number(scoreElementProblem(metrics, v4Recipe).toFixed(6)),
    violations: listElementViolations(metrics, v4Recipe),
    stateReadingDepth: measureStateReadingDepth(space, 8),
  };
}

describe("もろい岩・薄い氷の特徴量（研究用の生成 v4）", () => {
  test.each(reference.v4.candidates.map((entry) => [entry.id, entry] as const))(
    "試遊候補 %s の特徴量・難しさの点・目的関数・採用条件・状態の読み深さが一致すること",
    (_, entry) => {
      expect(measureElementEntry(entry)).toEqual(entry.metrics);
    },
  );

  test.each(reference.v4.boards.map((entry, index) => [index, entry] as const))(
    "固定 seed のランダム盤面 %i の特徴量・盤面の外・ゴールの選び方が一致すること",
    (_, entry) => {
      const board = parseGenerationBoardRows(entry.rows);
      const outside = markOutsideCells({
        board,
        start: entry.start,
        goal: entry.goal,
      });
      const evaluation = evaluateElementContext(
        createElementContext(board, entry.start),
        v4Recipe,
      );

      expect({
        metrics: measureElementEntry(entry),
        outside: {
          width: outside.board.width,
          rows: formatGenerationBoardRows(outside.board),
          start: outside.start,
          goal: outside.goal,
        },
        evaluation: {
          score: Number(evaluation.score.toFixed(6)),
          goal: evaluation.goal,
        },
      }).toEqual({
        metrics: entry.metrics,
        outside: toPortrait(entry.outside),
        evaluation: entry.evaluation,
      });
    },
  );
});

type StaticEntry = {
  rows: readonly string[];
  start: number;
  goal: number;
  tactics: unknown;
  tags: unknown;
  shallowDepth: unknown;
  humanDepth: unknown;
  nearPathCount: unknown;
  defaultScore: unknown;
  levelOneScore: unknown;
};

function measureStaticEntry(entry: StaticEntry) {
  const board = parseGenerationBoardRows(entry.rows);
  const graph = createStaticBoardGraph(
    board.width,
    board.height,
    createStaticStopper(board),
    entry.start,
  );
  const tactics = measureStaticTactics(graph, entry.start, entry.goal);
  const cellCount = board.width * board.height;
  const levelOneWeights = {
    ...createTacticWeights(
      ["stopper"],
      ["wrap-around", "pass-lure", "trap-lure", "backward-funnel"],
    ),
    read: 0,
  };
  return {
    tactics,
    tags: listStaticTacticTags(tactics),
    shallowDepth: measureStaticReadingDepth(graph, entry.start, entry.goal, 3),
    humanDepth: measureStaticReadingDepth(
      graph,
      entry.start,
      entry.goal,
      MAXIMUM_READING_DEPTH,
    ),
    nearPathCount: countNearPaths(graph, entry.start, entry.goal),
    defaultScore: Number(
      scoreTactics(
        tactics,
        { ...defaultTacticWeights, unused: 0 },
        cellCount,
        0,
      ).toFixed(6),
    ),
    levelOneScore: Number(
      scoreTactics(
        tactics,
        { ...levelOneWeights, unused: 0 },
        cellCount,
        0,
      ).toFixed(6),
    ),
  };
}

function pickStaticExpectation(entry: StaticEntry) {
  const { tactics, tags, shallowDepth, humanDepth, nearPathCount } = entry;
  return {
    tactics,
    tags,
    shallowDepth,
    humanDepth,
    nearPathCount,
    defaultScore: entry.defaultScore,
    levelOneScore: entry.levelOneScore,
  };
}

describe("氷と岩だけの手筋の特徴量（研究用の生成 v2）", () => {
  test.each(reference.v2.candidates.map((entry) => [entry.id, entry] as const))(
    "試遊候補 %s の手筋・タグ・読み深さ・近い別解・目的関数が一致すること",
    (_, entry) => {
      expect(measureStaticEntry(entry)).toEqual(pickStaticExpectation(entry));
    },
  );

  test.each(reference.v2.boards.map((entry, index) => [index, entry] as const))(
    "固定 seed のランダム盤面 %i の手筋とゴールの選び方が一致すること",
    (_, entry) => {
      const board = parseGenerationBoardRows(entry.rows);
      const { evaluationRecipe } = reference.v2;
      const evaluation = evaluateTacticBoard(
        board.width,
        board.height,
        createStaticStopper(board),
        entry.start,
        {
          minimum: evaluationRecipe.shortest[0]!,
          maximum: evaluationRecipe.shortest[1]!,
        },
        {
          ...createTacticWeights(
            evaluationRecipe.required as StaticTacticTag[],
            evaluationRecipe.forbidden as StaticTacticTag[],
          ),
          unused: 0,
        },
      );

      expect({
        ...measureStaticEntry(entry),
        evaluation: {
          ...evaluation,
          score: Number(evaluation.score.toFixed(6)),
        },
      }).toEqual({
        ...pickStaticExpectation(entry),
        evaluation: entry.evaluation,
      });
    },
  );
});
