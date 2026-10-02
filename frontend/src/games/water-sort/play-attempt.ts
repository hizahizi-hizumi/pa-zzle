import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";
import type { WaterSortProblemIdentity } from "@/games/water-sort/problem/problem";
import {
  getWaterSortSessionElapsedMs,
  type WaterSortSession,
} from "@/games/water-sort/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type WaterSortPlayAttemptStart = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使うクリアまでの手数・最短手数は保存しない。 */
type WaterSortPlayAttemptProgress = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export type WaterSortPlayAttempt = PlayAttempt & {
  payloadVersion: typeof WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: WaterSortPlayAttemptStart;
};

type CreateWaterSortPlayAttemptInput = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  startedAt: number;
};

export function createWaterSortPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateWaterSortPlayAttemptInput): WaterSortPlayAttempt {
  const gameId = waterSortPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION,
    start: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
    },
    abandonment: null,
  };
}

export function createWaterSortPlayAttemptProgress(
  session: WaterSortSession,
  abandonedAt: number,
): WaterSortPlayAttemptProgress {
  return {
    elapsedMs: getWaterSortSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
