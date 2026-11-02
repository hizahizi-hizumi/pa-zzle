import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import type { BridgesIdentifiedProblem } from "@/games/bridges/problem/problem";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";

/**
 * どの難易度でも出す1問。研究用の生成器（`scripts/research/bridges_supply.py` の `generate`、
 * 乱数の種 2・7×7・島の密度 0.3・2本橋 0.3・閉路 0.3）で作った一意解の問題で、全部の島のつながりを読む所がある。
 */
const fixedProblem: BridgesIdentifiedProblem = {
  problem: parseBridgesBoard([
    "2..2..2",
    ".2..3..",
    "3.1...2",
    ".2..3..",
    ".......",
    ".2.1...",
    "3...4.2",
  ]),
  identity: {
    generatorVersion: "research-supply",
    seed: "2",
    conditions: { width: 7, height: 7 },
  },
};

/** 難易度の問題を seed で1問選ぶ。どの難易度・seed でも同じ1問を返す。 */
export function selectBridgesProblemForDifficulty(
  _difficulty: BridgesDifficulty,
  _seed: ProblemSeed,
): BridgesIdentifiedProblem {
  return fixedProblem;
}

/** 難易度で出す問題を問題 ID で引く。引けない ID には `null` を返す。 */
export function selectBridgesProblemById(
  _difficulty: BridgesDifficulty,
  problemId: ProblemId,
): BridgesIdentifiedProblem | null {
  return createProblemId(fixedProblem.identity) === problemId
    ? fixedProblem
    : null;
}

/** 難易度で出す問題を問題 ID で引けるか。 */
export function canSelectBridgesProblemById(
  difficulty: BridgesDifficulty,
  problemId: ProblemId,
): boolean {
  return selectBridgesProblemById(difficulty, problemId) !== null;
}
