import {
  createPlayRecordId,
  type PlayRecord,
} from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import {
  createFukumenzanResult,
  type FukumenzanResult,
} from "@/games/fukumenzan/play/use-fukumenzan-play";
import {
  type FukumenzanProblemIdentity,
  type FukumenzanRecordedProblemIdentity,
  isCurrentFukumenzanProblemIdentity,
  isFukumenzanRecordedProblemIdentity,
} from "@/games/fukumenzan/problem/problem";
import {
  type FukumenzanWorkload,
  isFukumenzanWorkload,
} from "@/games/fukumenzan/problem/workload";
import {
  calculateFukumenzanPlayScore,
  calculateFukumenzanTimeDeltaMs,
} from "@/games/fukumenzan/score";
import type { FukumenzanSessionResult } from "@/games/fukumenzan/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

const FUKUMENZAN_GAME_ID = "fukumenzan";
const FUKUMENZAN_PLAY_RECORD_PAYLOAD_VERSION = 1;

type FukumenzanPlayRecordPayload = {
  difficulty: FukumenzanDifficulty;
  /** 再プレイで問題集から同じ問題を引くのに使う。 */
  problemIdentity: FukumenzanRecordedProblemIdentity;
  workload: FukumenzanWorkload;
  /** 待った・盤面を戻した回数と、札・× の操作の回数は評価に使わないが、評価規則を見直すときの材料として残す。 */
  performance: FukumenzanSessionResult;
};

export type FukumenzanPlayRecord = PlayRecord & {
  gameId: typeof FUKUMENZAN_GAME_ID;
  payloadVersion: typeof FUKUMENZAN_PLAY_RECORD_PAYLOAD_VERSION;
  payload: FukumenzanPlayRecordPayload;
};

type CreateFukumenzanPlayRecordInput = {
  difficulty: FukumenzanDifficulty;
  problemIdentity: FukumenzanProblemIdentity;
  workload: FukumenzanWorkload;
  startedAt: number;
  completedAt: number;
  result: FukumenzanSessionResult;
};

/** 待ったは盤面操作1回ぶんを取り消すので、札と × の操作の回数の合計を超えない。 */
function isFukumenzanPerformance(
  value: unknown,
): value is FukumenzanSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.placeCount) &&
    isNonNegativeInteger(value.returnCount) &&
    isNonNegativeInteger(value.crossToggleCount) &&
    value.undoCount <=
      value.placeCount + value.returnCount + value.crossToggleCount
  );
}

export function isFukumenzanPlayRecord(
  record: PlayRecord,
): record is FukumenzanPlayRecord {
  if (
    record.gameId !== FUKUMENZAN_GAME_ID ||
    record.payloadVersion !== FUKUMENZAN_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isFukumenzanRecordedProblemIdentity(problemIdentity) &&
    isFukumenzanWorkload(workload) &&
    isFukumenzanPerformance(performance)
  );
}

/** 読み戻した記録に余分な項目があっても結果へ持ち込まない。 */
function copyPerformance({
  elapsedMs,
  undoCount,
  restartCount,
  placeCount,
  returnCount,
  crossToggleCount,
}: FukumenzanSessionResult): FukumenzanSessionResult {
  return {
    elapsedMs,
    undoCount,
    restartCount,
    placeCount,
    returnCount,
    crossToggleCount,
  };
}

function copyWorkload({
  letterCount,
  letterCellCount,
}: FukumenzanWorkload): FukumenzanWorkload {
  return { letterCount, letterCellCount };
}

export type FukumenzanRecordedResult = {
  difficulty: FukumenzanDifficulty;
  problemIdentity: FukumenzanProblemIdentity;
  result: FukumenzanResult;
};

/** 今の版の記録で、今の生成器の問題のときだけ作れる。 */
export function restoreFukumenzanRecordedResult(
  record: PlayRecord,
): FukumenzanRecordedResult | null {
  if (
    !isFukumenzanPlayRecord(record) ||
    !isCurrentFukumenzanProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createFukumenzanResult(
      copyPerformance(performance),
      copyWorkload(workload),
    ),
  };
}

export function createFukumenzanPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateFukumenzanPlayRecordInput): FukumenzanPlayRecord {
  return {
    id: createPlayRecordId([
      FUKUMENZAN_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: FUKUMENZAN_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: FUKUMENZAN_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: {
          addendLengths: [...problemIdentity.conditions.addendLengths],
        },
      },
      workload: copyWorkload(workload),
      performance: copyPerformance(result),
    },
  };
}

export function getFukumenzanPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isFukumenzanPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateFukumenzanPlayScore({
    elapsedMs: performance.elapsedMs,
    workload,
  }).total;
}

export function getFukumenzanPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isFukumenzanPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateFukumenzanTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type FukumenzanPlayRecordMetricId = "play-score" | "time-delta-ms";

export const fukumenzanPlayRecordDefinition = {
  gameId: FUKUMENZAN_GAME_ID,
  isRecord: isFukumenzanPlayRecord,
  getComparisonKey(record) {
    return isFukumenzanPlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isFukumenzanPlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getFukumenzanPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getFukumenzanPlayRecordTimeDelta,
    },
  ],
} satisfies PlayRecordDefinition<FukumenzanPlayRecordMetricId>;
