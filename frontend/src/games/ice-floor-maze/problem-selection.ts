import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  generateIceFloorMazeProblem,
  type IceFloorMazeGeneratedProblem,
} from "@/games/ice-floor-maze/problem/generator";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";
import type { ProblemSeed } from "@/games/problem-seed";

/**
 * 難易度ごとの仮の盤面の形。難易度分析と問題集が無いので、ゴールは計画深さを問わず選び、レベルの難しさは保証しない。
 * 形は、レベルごとに許す盤面の形の範囲（実装前提調査 §11）から1つずつ選んだもの。
 */
const provisionalBoardShapeByDifficulty = {
  "1": { width: 8, height: 8 },
  "2": { width: 8, height: 10 },
  "3": { width: 9, height: 12 },
  "4": { width: 10, height: 13 },
  "5": { width: 12, height: 14 },
} as const satisfies Record<IceFloorMazeDifficulty, IceFloorMazeBoardShape>;

/** 難易度の仮の盤面の形で、seed から問題を作る。 */
export function selectIceFloorMazeProblemForDifficulty(
  difficulty: IceFloorMazeDifficulty,
  seed: ProblemSeed,
): IceFloorMazeGeneratedProblem {
  return generateIceFloorMazeProblem(seed, {
    ...provisionalBoardShapeByDifficulty[difficulty],
  });
}
