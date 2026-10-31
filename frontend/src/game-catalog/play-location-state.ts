import type { ProblemId } from "@/games/problem-id";
import { isRecordObject } from "@/lib/type-guards";

/** プレイ画面へ遷移するときに渡す location state。 */
export type PlayLocationState = {
  /**
   * 最初の問題として選ばない問題の ID。直前に遊んだ問題を続けて出さないために渡す。
   * URL の `problem` クエリで問題を指定したときは、そちらを優先する。
   */
  avoidedProblemId: ProblemId;
};

export function createPlayLocationState(
  avoidedProblemId: ProblemId,
): PlayLocationState {
  return { avoidedProblemId };
}

/** location state から避ける問題の ID を読む。プレイ画面向けの state でなければ `undefined` を返す。 */
export function readAvoidedProblemId(state: unknown): ProblemId | undefined {
  return isRecordObject(state) && typeof state.avoidedProblemId === "string"
    ? state.avoidedProblemId
    : undefined;
}
