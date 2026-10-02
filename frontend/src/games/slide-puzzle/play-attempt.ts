import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { slidePuzzlePlayRecordDefinition } from "@/games/slide-puzzle/play-record";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import {
  getSlidePuzzleSessionElapsedMs,
  type SlidePuzzleSession,
} from "@/games/slide-puzzle/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type SlidePuzzlePlayAttemptStart = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使う最後に盤面を戻してからの手数・最短手数は保存しない。 */
type SlidePuzzlePlayAttemptProgress = {
  elapsedMs: number;
  moveCount: number;
  slideCount: number;
  restartCount: number;
};

export type SlidePuzzlePlayAttempt = PlayAttempt & {
  payloadVersion: typeof SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: SlidePuzzlePlayAttemptStart;
};

type CreateSlidePuzzlePlayAttemptInput = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  startedAt: number;
};

export function createSlidePuzzlePlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateSlidePuzzlePlayAttemptInput): SlidePuzzlePlayAttempt {
  const gameId = slidePuzzlePlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createSlidePuzzlePlayAttemptProgress(
  session: SlidePuzzleSession,
  abandonedAt: number,
): SlidePuzzlePlayAttemptProgress {
  return {
    elapsedMs: getSlidePuzzleSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  };
}
