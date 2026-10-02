import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { reflectionPlayRecordDefinition } from "@/games/reflection/play-record";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import {
  getReflectionSessionElapsedMs,
  type ReflectionSession,
} from "@/games/reflection/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type ReflectionPlayAttemptStart = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type ReflectionPlayAttemptProgress = {
  elapsedMs: number;
  relocationCount: number;
  restartCount: number;
  laserCheckCount: number;
  inputCount: number;
};

export type ReflectionPlayAttempt = PlayAttempt & {
  payloadVersion: typeof REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: ReflectionPlayAttemptStart;
};

type CreateReflectionPlayAttemptInput = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  startedAt: number;
};

export function createReflectionPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateReflectionPlayAttemptInput): ReflectionPlayAttempt {
  const gameId = reflectionPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createReflectionPlayAttemptProgress(
  session: ReflectionSession,
  abandonedAt: number,
): ReflectionPlayAttemptProgress {
  return {
    elapsedMs: getReflectionSessionElapsedMs(session, abandonedAt),
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  };
}
