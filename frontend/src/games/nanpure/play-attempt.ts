import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import type { NanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import {
  getNanpureSessionElapsedMs,
  type NanpureSession,
} from "@/games/nanpure/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type NanpurePlayAttemptStart = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type NanpurePlayAttemptProgress = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

export type NanpurePlayAttempt = PlayAttempt & {
  payloadVersion: typeof NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: NanpurePlayAttemptStart;
};

type CreateNanpurePlayAttemptInput = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  startedAt: number;
};

export function createNanpurePlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateNanpurePlayAttemptInput): NanpurePlayAttempt {
  const gameId = nanpurePlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createNanpurePlayAttemptProgress(
  session: NanpureSession,
  abandonedAt: number,
): NanpurePlayAttemptProgress {
  return {
    elapsedMs: getNanpureSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
