import {
  parseReflectionDifficulty,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import {
  isReflectionProblemIdentity,
  isReflectionRecordedProblemIdentity,
  isReflectionSolveWorkload,
  isReflectionWorkloadOfIdentity,
  type ReflectionProblemIdentity,
  type ReflectionRecordedProblemIdentity,
  type ReflectionSolveWorkload,
} from "@/games/reflection/problem/problem";
import {
  calculateReflectionPlayScore,
  calculateReflectionTimeDeltaMs,
} from "@/games/reflection/score";
import type { ReflectionSessionResult } from "@/games/reflection/session/session";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const REFLECTION_GAME_ID = "reflection";
const REFLECTION_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。問題集の版と番号は問題集を作り直すと変わるので保存せず、必要なら identity の seed から引く。
 *   生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   光路を確かめた回数・入力回数は評価に使わないが、評価規則を見直すときの材料として残す。
 */
type ReflectionPlayRecordPayload = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionRecordedProblemIdentity;
  workload: ReflectionSolveWorkload;
  performance: ReflectionSessionResult;
};

export type ReflectionPlayRecord = PlayRecord & {
  gameId: typeof REFLECTION_GAME_ID;
  payloadVersion: typeof REFLECTION_PLAY_RECORD_PAYLOAD_VERSION;
  payload: ReflectionPlayRecordPayload;
};

type CreateReflectionPlayRecordInput = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  workload: ReflectionSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: ReflectionSessionResult;
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 置き直しは盤面を変える入力で起きるので、入力回数を超えない。
 * 以前の記録にある `undoCount` のような評価に使わない項目は、読み込みで無視する。
 */
function isReflectionPerformance(
  value: unknown,
): value is ReflectionSessionResult {
  return (
    isRecordObject(value) &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    isNonNegativeInteger(value.relocationCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.laserCheckCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.relocationCount <= value.inputCount
  );
}

function isWorkloadOfRecordedIdentity(
  workload: ReflectionSolveWorkload,
  identity: ReflectionRecordedProblemIdentity,
): boolean {
  return (
    !isReflectionProblemIdentity(identity) ||
    isReflectionWorkloadOfIdentity(workload, identity)
  );
}

export function isReflectionPlayRecord(
  record: PlayRecord,
): record is ReflectionPlayRecord {
  if (
    record.gameId !== REFLECTION_GAME_ID ||
    record.payloadVersion !== REFLECTION_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseReflectionDifficulty(difficulty) !== undefined &&
    isReflectionRecordedProblemIdentity(problemIdentity) &&
    isReflectionSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isReflectionPerformance(performance)
  );
}

export function createReflectionPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateReflectionPlayRecordInput): ReflectionPlayRecord {
  return {
    id: createPlayRecordId([
      REFLECTION_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: REFLECTION_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: REFLECTION_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      workload: {
        pieceCount: workload.pieceCount,
        clueCount: workload.clueCount,
        propagationRoundCount: workload.propagationRoundCount,
        assumptionTestCount: workload.assumptionTestCount,
      },
      performance: {
        elapsedMs: result.elapsedMs,
        relocationCount: result.relocationCount,
        restartCount: result.restartCount,
        laserCheckCount: result.laserCheckCount,
        inputCount: result.inputCount,
      },
    },
  };
}

export function getReflectionPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isReflectionPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateReflectionPlayScore({ ...performance, workload }).total;
}

export function getReflectionPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isReflectionPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateReflectionTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export const reflectionPlayRecordDefinition: PlayRecordDefinition = {
  gameId: REFLECTION_GAME_ID,
  isRecord: isReflectionPlayRecord,
  getComparisonKey(record) {
    return isReflectionPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getReflectionPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getReflectionPlayRecordTimeDelta,
    },
    {
      id: "relocation-count",
      direction: "lower",
      getValue(record) {
        return isReflectionPlayRecord(record)
          ? record.payload.performance.relocationCount
          : null;
      },
    },
  ],
};
