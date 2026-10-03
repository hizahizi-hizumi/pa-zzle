import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";
import {
  createProblemSeed,
  hashProblemSeed,
  type ProblemSeed,
} from "@/games/problem-seed";

/**
 * 問題集から seed で1問を選ぶ。同じ seed と問題集からは同じ1問を選ぶ。
 * `poolDescription` は問題集が空のときの例外で、どの問題集かを示す。
 */
export function selectProblemPoolEntry<Entry>(
  entries: readonly Entry[],
  seed: ProblemSeed,
  poolDescription: string,
): Entry {
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (entry === undefined) {
    throw new Error(`No ${poolDescription} problem is available`);
  }
  return entry;
}

// 問題集に避ける問題しか無いときにも選択を終えるための、選び直す回数の上限。
const maximumAvoidingSelectionAttempts = 8;

/** 新しい seed と、その seed で選んだ1問。 */
export type SeededProblemSelection<Problem> = {
  seed: ProblemSeed;
  problem: Problem;
};

/**
 * 新しい seed で1問を選ぶ。`avoidedProblemId` の問題を選んだら seed を変えて選び直す。
 * 選び直しには上限があり、上限まで避けられなければ最後に選んだ問題を返す。
 */
export function selectProblemAvoiding<
  Problem extends { identity: ProblemIdentity },
>(
  selectProblem: (seed: ProblemSeed) => Problem,
  avoidedProblemId?: ProblemId,
): SeededProblemSelection<Problem> {
  let seed = createProblemSeed();
  let problem = selectProblem(seed);
  for (
    let attempt = 1;
    attempt < maximumAvoidingSelectionAttempts &&
    avoidedProblemId !== undefined &&
    createProblemId(problem.identity) === avoidedProblemId;
    attempt += 1
  ) {
    seed = createProblemSeed();
    problem = selectProblem(seed);
  }
  return { seed, problem };
}
