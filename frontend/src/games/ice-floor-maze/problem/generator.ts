import {
  analyzeIceFloorMazeDifficulty,
  type IceFloorMazeDifficultyAnalysis,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { ElementRecipe } from "@/games/ice-floor-maze/problem/generation/element-objective";
import {
  type ElementSearchSettings,
  searchElementProblem,
} from "@/games/ice-floor-maze/problem/generation/element-search";
import {
  type GenerationProblem,
  markOutsideCells,
} from "@/games/ice-floor-maze/problem/generation/outside-cells";
import {
  CELL_ICE,
  CELL_ROCK,
  fromGenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import {
  searchTacticProblem,
  type TacticRecipe,
} from "@/games/ice-floor-maze/problem/generation/tactic-search";
import {
  assertIceFloorMazeProblem,
  createIceFloorMazeProblemIdentity,
  type IceFloorMazeIdentifiedProblem,
  type IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";

/**
 * 1問の生成条件。
 * - `tactics`: 氷と岩だけの盤面で、手筋の点を最大にする山登り（研究用の生成 v2）。
 * - `elements`: もろい岩・薄い氷を置き、難しさの点を最大にする山登り（研究用の生成 v4）。`search` は山登りの止め方。
 */
export type IceFloorMazeGenerationRecipe =
  | { kind: "tactics"; recipe: TacticRecipe }
  | {
      kind: "elements";
      recipe: ElementRecipe;
      search: ElementSearchSettings;
    };

/**
 * 生成器が返す問題。盤面は駒が通らないマスを盤面の外にして切り落としてある。
 * - `optimalMoveCount`: 開始位置からゴールで止まるまでの最少手数。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `analysis`: 盤面の外にした後の問題の難易度の特徴。
 * - `searchIterationCount` / `acceptedAtIteration`: 山登りの回数と、要素のある問題で採用条件を初めて満たした回。
 */
export type IceFloorMazeGeneratedProblem = IceFloorMazeIdentifiedProblem & {
  optimalMoveCount: number;
  symmetryKey: string;
  analysis: IceFloorMazeDifficultyAnalysis;
  searchIterationCount: number;
  acceptedAtIteration: number | null;
};

type SearchOutcome = {
  problem: GenerationProblem;
  iterationCount: number;
  acceptedAtIteration: number | null;
};

function search(
  generation: IceFloorMazeGenerationRecipe,
  seed: ProblemSeed,
): SearchOutcome | null {
  const random = createProblemSeededRandom(`ice-floor-maze:${seed}`);
  if (generation.kind === "tactics") {
    const { recipe } = generation;
    const found = searchTacticProblem(recipe, random);
    return found
      ? {
          problem: {
            board: {
              width: recipe.width,
              height: recipe.height,
              cells: found.stopper.map((value) =>
                value === 1 ? CELL_ROCK : CELL_ICE,
              ),
            },
            start: found.start,
            goal: found.goal,
          },
          iterationCount: recipe.iterations,
          acceptedAtIteration: null,
        }
      : null;
  }
  const found = searchElementProblem(
    generation.recipe,
    random,
    generation.search,
  );
  return found && found.goal >= 0
    ? {
        problem: { board: found.board, start: found.start, goal: found.goal },
        iterationCount: found.iterationCount,
        acceptedAtIteration: found.acceptedAtIteration,
      }
    : null;
}

function toPlayableProblem(
  problem: GenerationProblem,
): IceFloorMazeProblem | null {
  const playable = {
    board: fromGenerationBoard(problem.board),
    start: problem.start,
    goal: problem.goal,
  };
  try {
    assertIceFloorMazeProblem(playable);
  } catch {
    return null;
  }
  return playable;
}

/**
 * 生成条件と seed から1問を作る。同じ条件と seed からは同じ問題を作る。
 * 山登りで盤面を作り、駒が通らないマスを盤面の外にして切り落とし、難易度の特徴を求める。
 * 採否（どのレベルに当たるか）は呼び出し側が分類で決める。範囲の手数で止まれる盤面を作れない、打ち切る方式で
 * 採用条件を満たさない、切り落とした盤面が遊べる形でないときは `null`。
 */
export function generateIceFloorMazeProblem(
  generation: IceFloorMazeGenerationRecipe,
  seed: ProblemSeed,
): IceFloorMazeGeneratedProblem | null {
  const outcome = search(generation, seed);
  if (!outcome) {
    return null;
  }
  const problem = toPlayableProblem(markOutsideCells(outcome.problem));
  if (!problem) {
    return null;
  }
  const analysis = analyzeIceFloorMazeDifficulty(problem);
  if (analysis.status !== "analyzed") {
    return null;
  }
  return {
    problem,
    identity: createIceFloorMazeProblemIdentity(problem),
    optimalMoveCount: analysis.features.optimalMoveCount,
    symmetryKey: getIceFloorMazeSymmetryKey(problem),
    analysis,
    searchIterationCount: outcome.iterationCount,
    acceptedAtIteration: outcome.acceptedAtIteration,
  };
}
