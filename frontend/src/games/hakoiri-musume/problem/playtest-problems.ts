import playtestProblemsJson from "@/games/hakoiri-musume/problem/playtest-problems.json";
import {
  createHakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import type { HakoiriMusumePooledProblem } from "@/games/hakoiri-musume/problem/problem-pool";

/**
 * 開発時の試遊と試験でだけ使い、問題集には入れない。
 * - `id`: `<族>-<番号>`（例 `B66-1`）。
 * - `seed`: `formatHakoiriMusumeProblemSeed` の書き方。
 * - `solution`: 最短解の1つ。手ごとに、動かす駒の左上のマスの、動かす前と後。
 */
export type HakoiriMusumePlaytestProblem = {
  id: string;
  familyLabel: string;
  seed: string;
  optimalMoveCount: number;
  solution: readonly (readonly [from: number, to: number])[];
};

export const hakoiriMusumePlaytestProblems =
  playtestProblemsJson as unknown as readonly HakoiriMusumePlaytestProblem[];

/** 試遊用の問題は準備の長さを測らないので 0 とし、速さの基準時間は最短手数だけで決まる。 */
export function findHakoiriMusumePlaytestProblem(
  id: string,
): HakoiriMusumePooledProblem | null {
  const entry = hakoiriMusumePlaytestProblems.find(
    (candidate) => candidate.id === id,
  );
  if (!entry) {
    return null;
  }
  const identity = createHakoiriMusumeProblemIdentity(entry.seed);
  return {
    ...restoreHakoiriMusumeProblem(identity),
    workload: {
      optimalMoveCount: entry.optimalMoveCount,
      preparationLength: 0,
    },
  };
}
