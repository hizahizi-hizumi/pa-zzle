import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import type { TakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionElapsedMs,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type TakuzuPlayAttemptStart = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type TakuzuPlayAttemptProgress = {
  elapsedMs: number;
  correctionCount: number;
  restartCount: number;
  undoCount: number;
  inputCount: number;
};

export type TakuzuPlayAttempt = PlayAttempt & {
  payloadVersion: typeof TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: TakuzuPlayAttemptStart;
};

type CreateTakuzuPlayAttemptInput = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  startedAt: number;
};

export function createTakuzuPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateTakuzuPlayAttemptInput): TakuzuPlayAttempt {
  const gameId = takuzuPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createTakuzuPlayAttemptProgress(
  session: TakuzuSession,
  abandonedAt: number,
): TakuzuPlayAttemptProgress {
  return {
    elapsedMs: getTakuzuSessionElapsedMs(session, abandonedAt),
    correctionCount: getTakuzuSessionCorrectionCount(session),
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    inputCount: session.inputCount,
  };
}
