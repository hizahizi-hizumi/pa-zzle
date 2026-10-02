import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import {
  getMinesweeperSessionElapsedMs,
  type MinesweeperSession,
} from "@/games/minesweeper/session/session";
import { createPlayAttemptId, type PlayAttempt } from "@/records/play-attempt";

const MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type MinesweeperPlayAttemptStart = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使う最小の開く回数は保存しない。 */
type MinesweeperPlayAttemptProgress = {
  elapsedMs: number;
  mistakeCount: number;
};

export type MinesweeperPlayAttempt = PlayAttempt & {
  payloadVersion: typeof MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: MinesweeperPlayAttemptStart;
};

type CreateMinesweeperPlayAttemptInput = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  startedAt: number;
};

export function createMinesweeperPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateMinesweeperPlayAttemptInput): MinesweeperPlayAttempt {
  const gameId = minesweeperPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createMinesweeperPlayAttemptProgress(
  session: MinesweeperSession,
  abandonedAt: number,
): MinesweeperPlayAttemptProgress {
  return {
    elapsedMs: getMinesweeperSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
  };
}
