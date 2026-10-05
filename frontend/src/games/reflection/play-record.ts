import { parseDifficultyLevel } from "@/games/difficulty";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  createReflectionResult,
  type ReflectionResult,
} from "@/games/reflection/play/use-reflection-play";
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
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const REFLECTION_GAME_ID = "reflection";
const REFLECTION_PLAY_RECORD_PAYLOAD_VERSION = 2;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。問題集の版と番号は問題集を作り直すと変わるので保存せず、必要なら identity の seed から引く。
 *   生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   置き直し・盤面を戻した回数・光路を確かめた回数・入力回数は評価に使わないが、結果・記録画面に出し、評価規則を見直すときの材料として残す。
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

/**
 * 置き直しは盤面を変える入力で起きるので、入力回数を超えない。
 * 以前の記録にある `undoCount` のような評価に使わない項目は、読み込みで無視する。
 */
function isReflectionPerformance(
  value: unknown,
): value is ReflectionSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
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
    parseDifficultyLevel(difficulty) !== undefined &&
    isReflectionRecordedProblemIdentity(problemIdentity) &&
    isReflectionSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isReflectionPerformance(performance)
  );
}

/** 記録から作り直した、結果画面に出す内容。 */
export type ReflectionRecordedResult = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  result: ReflectionResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreReflectionRecordedResult(
  record: PlayRecord,
): ReflectionRecordedResult | null {
  if (
    !isReflectionPlayRecord(record) ||
    !isReflectionProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  // 以前の記録にある評価に使わない項目を結果へ持ち込まない。
  const sessionResult: ReflectionSessionResult = {
    elapsedMs: performance.elapsedMs,
    relocationCount: performance.relocationCount,
    restartCount: performance.restartCount,
    laserCheckCount: performance.laserCheckCount,
    inputCount: performance.inputCount,
  };
  return {
    difficulty,
    problemIdentity,
    result: createReflectionResult(sessionResult, workload),
  };
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
        trialMoveCount: workload.trialMoveCount,
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
  return calculateReflectionPlayScore({
    elapsedMs: performance.elapsedMs,
    workload,
  });
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

export type ReflectionPlayRecordMetricId = "play-score" | "time-delta-ms";

export const reflectionPlayRecordDefinition = {
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
  ],
} satisfies PlayRecordDefinition<ReflectionPlayRecordMetricId>;
