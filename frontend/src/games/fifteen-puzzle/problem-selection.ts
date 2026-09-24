// 暫定版: 難易度ごとの仮の撹拌手数でその場生成する。
// 難易度分析と問題集を用意した段階で、問題集からの選択へ置き換える。
import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { restoreFifteenPuzzleProblem } from "@/games/fifteen-puzzle/problem/generator";
import {
  FIFTEEN_PUZZLE_GENERATOR_VERSION,
  type FifteenPuzzleGeneratedProblem,
} from "@/games/fifteen-puzzle/problem/problem";
import {
  FIFTEEN_PUZZLE_SIZE,
  isFifteenPuzzleSolved,
} from "@/games/fifteen-puzzle/puzzle/state";
import type { ProblemSeed } from "@/games/problem-seed";

const provisionalScrambleLengths: Record<FifteenPuzzleDifficulty, number> = {
  "1": 15,
  "2": 25,
  "3": 35,
  "4": 60,
  "5": 150,
};

const MAXIMUM_ATTEMPTS = 10;

export function selectFifteenPuzzleProblemForDifficulty(
  difficulty: FifteenPuzzleDifficulty,
  seed: ProblemSeed,
): FifteenPuzzleGeneratedProblem {
  for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
    const { problem, identity } = restoreFifteenPuzzleProblem({
      generatorVersion: FIFTEEN_PUZZLE_GENERATOR_VERSION,
      seed: attempt === 0 ? seed : `${seed}-${attempt}`,
      conditions: {
        size: FIFTEEN_PUZZLE_SIZE,
        scrambleLength: provisionalScrambleLengths[difficulty],
      },
    });
    if (!isFifteenPuzzleSolved(problem.initialBoard)) {
      return { problem, identity, optimalMoveCount: null };
    }
  }

  throw new Error(`No level ${difficulty} fifteen puzzle problem is available`);
}
