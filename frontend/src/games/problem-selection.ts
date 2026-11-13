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

export type SeededProblemSelection<Problem> = {
  seed: ProblemSeed;
  problem: Problem;
};

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
