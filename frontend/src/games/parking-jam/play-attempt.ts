import {
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import { parkingJamPlayRecordDefinition } from "@/games/parking-jam/play-record";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import {
  getParkingJamSessionElapsedMs,
  type ParkingJamSession,
} from "@/games/parking-jam/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type ParkingJamPlayAttemptStart = {
  difficulty: ParkingJamDifficulty;
  difficultyModelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  problemIdentity: ParkingJamProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type ParkingJamPlayAttemptProgress = {
  elapsedMs: number;
  moveAttemptCount: number;
  successfulMoveCount: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export type ParkingJamPlayAttempt = PlayAttempt & {
  payloadVersion: typeof PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: ParkingJamPlayAttemptStart;
};

type CreateParkingJamPlayAttemptInput = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  startedAt: number;
};

export function createParkingJamPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateParkingJamPlayAttemptInput): ParkingJamPlayAttempt {
  const gameId = parkingJamPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION,
    start: {
      difficulty,
      difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
    },
    abandonment: null,
  };
}

export function createParkingJamPlayAttemptProgress(
  session: ParkingJamSession,
  abandonedAt: number,
): ParkingJamPlayAttemptProgress {
  return {
    elapsedMs: getParkingJamSessionElapsedMs(session, abandonedAt),
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
