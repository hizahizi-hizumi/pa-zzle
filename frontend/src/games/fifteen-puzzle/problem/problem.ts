import type {
  FIFTEEN_PUZZLE_SIZE,
  FifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";
import type { ProblemSeed } from "@/games/problem-seed";

export const FIFTEEN_PUZZLE_GENERATOR_VERSION = "1";

export type FifteenPuzzleGenerationConditions = {
  size: typeof FIFTEEN_PUZZLE_SIZE;
  /** 完成盤面から打つランダムな合法手の数。 */
  scrambleLength: number;
};

export type FifteenPuzzleProblem = {
  initialBoard: FifteenPuzzleBoard;
};

export type FifteenPuzzleProblemIdentity = {
  generatorVersion: typeof FIFTEEN_PUZZLE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: FifteenPuzzleGenerationConditions;
};

export type FifteenPuzzleGeneratedProblem = {
  problem: FifteenPuzzleProblem;
  identity: FifteenPuzzleProblemIdentity;
  /** 事前生成した問題集から引く。問題集に無い問題では不明。 */
  optimalMoveCount: number | null;
};
