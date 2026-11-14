import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";

export type ZukanNumber = {
  number: number;
  /** 番号を埋める桁数を決める。 */
  problemCount: number;
};

/** 今の問題集に無い問題は `null`。 */
export type FindZukanNumber = (
  difficulty: DifficultyLevel,
  problemId: ProblemId,
) => ZukanNumber | null;

export function createZukanNumberFinder(
  listPoolProblemIds: (difficulty: DifficultyLevel) => readonly ProblemId[],
): FindZukanNumber {
  let numbers: ReadonlyMap<string, number> | undefined;
  let problemCount = 0;

  function getNumbers(): ReadonlyMap<string, number> {
    if (numbers) {
      return numbers;
    }
    const built = new Map<string, number>();
    for (const { id: difficulty } of difficultyLevels) {
      for (const problemId of listPoolProblemIds(difficulty)) {
        problemCount += 1;
        built.set(`${difficulty}:${problemId}`, problemCount);
      }
    }
    numbers = built;
    return built;
  }

  return (difficulty, problemId) => {
    const number = getNumbers().get(`${difficulty}:${problemId}`);
    return number === undefined ? null : { number, problemCount };
  };
}
