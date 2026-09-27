// 難易度分析が無いため、レベルごとの盤面サイズと撹拌手数を仮の難易度としてその場で生成する。
import type { ProblemSeed } from "@/games/problem-seed";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { restoreSlidePuzzleProblem } from "@/games/slide-puzzle/problem/generator";
import {
  SLIDE_PUZZLE_GENERATOR_VERSION,
  type SlidePuzzleGeneratedProblem,
  type SlidePuzzleGenerationConditions,
} from "@/games/slide-puzzle/problem/problem";
import { calculateSlidePuzzleManhattanDistance } from "@/games/slide-puzzle/puzzle/state";

const provisionalConditions: Record<
  SlidePuzzleDifficulty,
  SlidePuzzleGenerationConditions
> = {
  "1": { size: 3, scrambleLength: 30 },
  "2": { size: 4, scrambleLength: 25 },
  "3": { size: 4, scrambleLength: 35 },
  "4": { size: 4, scrambleLength: 60 },
  "5": { size: 5, scrambleLength: 60 },
};

// 最短手数はマンハッタン距離以上なので、この距離以上の盤面は最短 8 手未満の自明な問題にならない。
const MINIMUM_MANHATTAN_DISTANCE = 8;
const MAXIMUM_ATTEMPTS = 10;

export function selectSlidePuzzleProblemForDifficulty(
  difficulty: SlidePuzzleDifficulty,
  seed: ProblemSeed,
): SlidePuzzleGeneratedProblem {
  for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
    const generatedProblem = restoreSlidePuzzleProblem({
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      seed: attempt === 0 ? seed : `${seed}-${attempt}`,
      conditions: provisionalConditions[difficulty],
    });
    if (
      calculateSlidePuzzleManhattanDistance(
        generatedProblem.problem.initialBoard,
      ) >= MINIMUM_MANHATTAN_DISTANCE
    ) {
      return generatedProblem;
    }
  }

  throw new Error(`No level ${difficulty} slide puzzle problem is available`);
}
