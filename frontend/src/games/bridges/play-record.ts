import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesResult,
  createBridgesResult,
} from "@/games/bridges/play/use-bridges-play";
import {
  type BridgesProblemIdentity,
  type BridgesRecordedProblemIdentity,
  isBridgesProblemIdentity,
  isBridgesRecordedProblemIdentity,
} from "@/games/bridges/problem/problem";
import {
  type BridgesSolveWorkload,
  isBridgesSolveWorkload,
} from "@/games/bridges/problem/workload";
import {
  calculateBridgesPlayScore,
  calculateBridgesTimeDeltaMs,
} from "@/games/bridges/score";
import type { BridgesSessionResult } from "@/games/bridges/session/session";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const BRIDGES_GAME_ID = "bridges";
const BRIDGES_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   待った・盤面を戻した回数・入力回数・交差に阻まれた回数は評価に使わないが、評価規則を見直すときの材料として残す。
 */
type BridgesPlayRecordPayload = {
  difficulty: BridgesDifficulty;
  problemIdentity: BridgesRecordedProblemIdentity;
  workload: BridgesSolveWorkload;
  performance: BridgesSessionResult;
};

export type BridgesPlayRecord = PlayRecord & {
  gameId: typeof BRIDGES_GAME_ID;
  payloadVersion: typeof BRIDGES_PLAY_RECORD_PAYLOAD_VERSION;
  payload: BridgesPlayRecordPayload;
};

type CreateBridgesPlayRecordInput = {
  difficulty: BridgesDifficulty;
  problemIdentity: BridgesProblemIdentity;
  workload: BridgesSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: BridgesSessionResult;
};

/** 待ったは入力1回ぶんを取り消すので、入力回数を超えない。 */
function isBridgesPerformance(value: unknown): value is BridgesSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.inputCount) &&
    isNonNegativeInteger(value.blockedCount) &&
    value.undoCount <= value.inputCount
  );
}

/** 今の生成器の identity なら、島の数が盤面のマスの数に収まるか。 */
function isWorkloadOfRecordedIdentity(
  workload: BridgesSolveWorkload,
  identity: BridgesRecordedProblemIdentity,
): boolean {
  if (!isBridgesProblemIdentity(identity)) {
    return true;
  }
  const { size } = identity.conditions;
  return workload.islandCount <= size * size;
}

export function isBridgesPlayRecord(
  record: PlayRecord,
): record is BridgesPlayRecord {
  if (
    record.gameId !== BRIDGES_GAME_ID ||
    record.payloadVersion !== BRIDGES_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isBridgesRecordedProblemIdentity(problemIdentity) &&
    isBridgesSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isBridgesPerformance(performance)
  );
}

/** 記録の値から、記録の項目だけを取り出す。読み戻した記録に余分な項目があっても結果へ持ち込まない。 */
function copyPerformance({
  elapsedMs,
  undoCount,
  restartCount,
  inputCount,
  blockedCount,
}: BridgesSessionResult): BridgesSessionResult {
  return { elapsedMs, undoCount, restartCount, inputCount, blockedCount };
}

function copyWorkload({
  islandCount,
  edgeCount,
  bridgeCount,
  countRoundCount,
  connectivityRoundCount,
  countReasoningUndecidedEdgeCount,
  lookaheadRoundCount,
  crossingBlockCount,
}: BridgesSolveWorkload): BridgesSolveWorkload {
  return {
    islandCount,
    edgeCount,
    bridgeCount,
    countRoundCount,
    connectivityRoundCount,
    countReasoningUndecidedEdgeCount,
    ...(lookaheadRoundCount === undefined ? {} : { lookaheadRoundCount }),
    ...(crossingBlockCount === undefined ? {} : { crossingBlockCount }),
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type BridgesRecordedResult = {
  difficulty: BridgesDifficulty;
  problemIdentity: BridgesProblemIdentity;
  result: BridgesResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreBridgesRecordedResult(
  record: PlayRecord,
): BridgesRecordedResult | null {
  if (
    !isBridgesPlayRecord(record) ||
    !isBridgesProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createBridgesResult(
      copyPerformance(performance),
      copyWorkload(workload),
    ),
  };
}

export function createBridgesPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateBridgesPlayRecordInput): BridgesPlayRecord {
  return {
    id: createPlayRecordId([
      BRIDGES_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: BRIDGES_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: BRIDGES_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      workload: copyWorkload(workload),
      performance: copyPerformance(result),
    },
  };
}

export function getBridgesPlayRecordScore(record: PlayRecord): number | null {
  if (!isBridgesPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateBridgesPlayScore({
    elapsedMs: performance.elapsedMs,
    workload,
  }).total;
}

export function getBridgesPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isBridgesPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateBridgesTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type BridgesPlayRecordMetricId = "play-score" | "time-delta-ms";

export const bridgesPlayRecordDefinition = {
  gameId: BRIDGES_GAME_ID,
  isRecord: isBridgesPlayRecord,
  getComparisonKey(record) {
    return isBridgesPlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isBridgesPlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getBridgesPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getBridgesPlayRecordTimeDelta,
    },
  ],
} satisfies PlayRecordDefinition<BridgesPlayRecordMetricId>;
