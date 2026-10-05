import { parseDifficultyLevel } from "@/games/difficulty";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  createMinesweeperResult,
  type MinesweeperResult,
} from "@/games/minesweeper/play/use-minesweeper-play";
import {
  isMinesweeperProblemIdentity,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperTimeDeltaMs,
} from "@/games/minesweeper/score";
import type { MinesweeperSessionResult } from "@/games/minesweeper/session/session";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION = 1;
const MINESWEEPER_GAME_ID = "minesweeper";

type MinesweeperPlayRecordPayload = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  performance: MinesweeperSessionResult;
};

export type MinesweeperPlayRecord = PlayRecord & {
  gameId: typeof MINESWEEPER_GAME_ID;
  payloadVersion: typeof MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION;
  payload: MinesweeperPlayRecordPayload;
};

type CreateMinesweeperPlayRecordInput = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: MinesweeperSessionResult;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isMinesweeperPerformance(
  value: unknown,
): value is MinesweeperSessionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<MinesweeperSessionResult>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.mistakeCount) &&
    isNonNegativeInteger(performance.minimumOpenCount)
  );
}

export function isMinesweeperPlayRecord(
  record: PlayRecord,
): record is MinesweeperPlayRecord {
  if (
    record.gameId !== MINESWEEPER_GAME_ID ||
    record.payloadVersion !== MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<MinesweeperPlayRecordPayload>;
  return (
    parseDifficultyLevel(payload.difficulty) !== undefined &&
    isMinesweeperProblemIdentity(payload.problemIdentity) &&
    isMinesweeperPerformance(payload.performance)
  );
}

export function createMinesweeperPlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateMinesweeperPlayRecordInput): MinesweeperPlayRecord {
  return {
    id: createPlayRecordId([
      MINESWEEPER_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
      problemIdentity.generationAttempt,
    ]),
    gameId: MINESWEEPER_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        mistakeCount: result.mistakeCount,
        minimumOpenCount: result.minimumOpenCount,
      },
    },
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type MinesweeperRecordedResult = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  result: MinesweeperResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreMinesweeperRecordedResult(
  record: PlayRecord,
): MinesweeperRecordedResult | null {
  if (!isMinesweeperPlayRecord(record)) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createMinesweeperResult(
      performance,
      problemIdentity.conditions.mineCount,
    ),
  };
}

export function getMinesweeperPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isMinesweeperPlayRecord(record)) {
    return null;
  }

  return calculateMinesweeperPlayScore({
    ...record.payload.performance,
    mineCount: record.payload.problemIdentity.conditions.mineCount,
  }).total;
}

export function getMinesweeperPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isMinesweeperPlayRecord(record)) {
    return null;
  }

  const { elapsedMs, minimumOpenCount } = record.payload.performance;
  return calculateMinesweeperTimeDeltaMs({
    elapsedMs,
    minimumOpenCount,
    mineCount: record.payload.problemIdentity.conditions.mineCount,
  });
}

export type MinesweeperPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "mistake-count";

export const minesweeperPlayRecordDefinition = {
  gameId: MINESWEEPER_GAME_ID,
  isRecord: isMinesweeperPlayRecord,
  getComparisonKey(record) {
    return isMinesweeperPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getMinesweeperPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getMinesweeperPlayRecordTimeDelta,
    },
    {
      id: "mistake-count",
      direction: "lower",
      getValue(record) {
        return isMinesweeperPlayRecord(record)
          ? record.payload.performance.mistakeCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<MinesweeperPlayRecordMetricId>;
