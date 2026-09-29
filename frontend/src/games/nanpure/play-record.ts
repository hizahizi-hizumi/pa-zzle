import {
  type LegacyNanpureDifficulty,
  type NanpureDifficulty,
  parseLegacyNanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import {
  isNanpureRecordedProblemIdentity,
  type NanpureProblemIdentity,
  type NanpureRecordedProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { calculateNanpurePlayScore } from "@/games/nanpure/score";
import type { NanpureSessionResult } from "@/games/nanpure/session/session";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const NANPURE_PLAY_RECORD_PAYLOAD_VERSION = 2;
const NANPURE_GAME_ID = "nanpure";

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階は保存せず、現在の評価規則で導出する。
 */
type NanpurePlayRecordPayload = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureRecordedProblemIdentity;
  performance: NanpureSessionResult;
};

// payloadVersion 1 は3段階（easy / normal / hard）の難易度と、ヒント数を指定した生成器（版 "1"）の問題で記録した。
// レベル1〜5へ読み替えず旧区分のまま扱い、自己ベストもレベルとは別の比較単位にする。
type NanpurePlayRecordPayloadV1 = Omit<
  NanpurePlayRecordPayload,
  "difficulty"
> & {
  difficulty: LegacyNanpureDifficulty;
};

type NanpurePlayRecordV1 = PlayRecord & {
  gameId: typeof NANPURE_GAME_ID;
  payloadVersion: 1;
  payload: NanpurePlayRecordPayloadV1;
};

export type NanpurePlayRecord = PlayRecord & {
  gameId: typeof NANPURE_GAME_ID;
  payloadVersion: typeof NANPURE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: NanpurePlayRecordPayload;
};

type RecognizedNanpurePlayRecord = NanpurePlayRecordV1 | NanpurePlayRecord;

type CreateNanpurePlayRecordInput = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: NanpureSessionResult;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNanpurePerformance(value: unknown): value is NanpureSessionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<NanpureSessionResult>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.mistakeCount) &&
    isNonNegativeInteger(performance.undoCount) &&
    isNonNegativeInteger(performance.restartCount)
  );
}

export function isNanpurePlayRecord(
  record: PlayRecord,
): record is RecognizedNanpurePlayRecord {
  if (
    record.gameId !== NANPURE_GAME_ID ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<
    Record<keyof NanpurePlayRecordPayload, unknown>
  >;
  const difficulty =
    typeof payload.difficulty === "string" ? payload.difficulty : undefined;
  const hasExpectedDifficulty =
    record.payloadVersion === 1
      ? parseLegacyNanpureDifficulty(difficulty) !== undefined
      : record.payloadVersion === NANPURE_PLAY_RECORD_PAYLOAD_VERSION &&
        parseNanpureDifficulty(difficulty) !== undefined;
  return (
    hasExpectedDifficulty &&
    isNanpureRecordedProblemIdentity(payload.problemIdentity) &&
    isNanpurePerformance(payload.performance)
  );
}

export function createNanpurePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateNanpurePlayRecordInput): NanpurePlayRecord {
  return {
    id: createPlayRecordId([
      NANPURE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: NANPURE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: NANPURE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        mistakeCount: result.mistakeCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
      },
    },
  };
}

export function getNanpurePlayRecordScore(
  record: RecognizedNanpurePlayRecord,
): number {
  return calculateNanpurePlayScore(record.payload.performance).total;
}

export type NanpurePlayRecordMetricId =
  | "play-score"
  | "elapsed-ms"
  | "mistake-count";

export const nanpurePlayRecordDefinition = {
  gameId: NANPURE_GAME_ID,
  isRecord: isNanpurePlayRecord,
  getComparisonKey(record) {
    return isNanpurePlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? getNanpurePlayRecordScore(record)
          : null;
      },
    },
    {
      id: "elapsed-ms",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? record.payload.performance.elapsedMs
          : null;
      },
    },
    {
      id: "mistake-count",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? record.payload.performance.mistakeCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<NanpurePlayRecordMetricId>;
