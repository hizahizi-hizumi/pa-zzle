import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";

/** ゲームの図鑑の番号。番号と、全問の数から決まる表示の桁数。 */
export type ZukanNumber = {
  number: number;
  /** ゲームの問題集の全問の数。番号を埋める桁数を決める。 */
  problemCount: number;
};

/** 問題 ID から図鑑の番号を引く。今の問題集に無い問題は `null`。 */
export type FindZukanNumber = (
  difficulty: DifficultyLevel,
  problemId: ProblemId,
) => ZukanNumber | null;

/**
 * 問題集の並び順（難易度の昇順、難易度の中は問題集の並び）で付ける図鑑の番号を、問題 ID で引けるようにする。
 * 番号の表は初めて引いたときに作る。
 */
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
