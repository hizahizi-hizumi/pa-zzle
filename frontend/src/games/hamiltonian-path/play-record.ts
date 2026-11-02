import { parseDifficultyLevel } from "@/games/difficulty";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import {
  createHamiltonianPathResult,
  type HamiltonianPathResult,
} from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  type HamiltonianPathProblemIdentity,
  type HamiltonianPathRecordedProblemIdentity,
  type HamiltonianPathSolveWorkload,
  isHamiltonianPathProblemIdentity,
  isHamiltonianPathRecordedProblemIdentity,
  isHamiltonianPathSolveWorkload,
  isHamiltonianPathWorkloadOfIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import {
  calculateHamiltonianPathPlayScore,
  calculateHamiltonianPathTimeDeltaMs,
} from "@/games/hamiltonian-path/score";
import type { HamiltonianPathSessionResult } from "@/games/hamiltonian-path/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const HAMILTONIAN_PATH_GAME_ID = "hamiltonian-path";
const HAMILTONIAN_PATH_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   戻したマスの数・待った・盤面を戻した回数・入力回数は評価に使わないが、評価規則を見直すときの材料として残す。
 */
type HamiltonianPathPlayRecordPayload = {
  difficulty: HamiltonianPathDifficulty;
  problemIdentity: HamiltonianPathRecordedProblemIdentity;
  workload: HamiltonianPathSolveWorkload;
  performance: HamiltonianPathSessionResult;
};

export type HamiltonianPathPlayRecord = PlayRecord & {
  gameId: typeof HAMILTONIAN_PATH_GAME_ID;
  payloadVersion: typeof HAMILTONIAN_PATH_PLAY_RECORD_PAYLOAD_VERSION;
  payload: HamiltonianPathPlayRecordPayload;
};

type CreateHamiltonianPathPlayRecordInput = {
  difficulty: HamiltonianPathDifficulty;
  problemIdentity: HamiltonianPathProblemIdentity;
  workload: HamiltonianPathSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: HamiltonianPathSessionResult;
};

/**
 * 待ったは入力1回ぶんを取り消すので、入力回数を超えない。
 * 引き直しは入力か待ったで道を変えたときに高々1回ずつ数えるので、その合計を超えない。
 */
function isHamiltonianPathPerformance(
  value: unknown,
): value is HamiltonianPathSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.backtrackCount) &&
    isNonNegativeInteger(value.retractedCellCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.undoCount <= value.inputCount &&
    value.backtrackCount <= value.inputCount + value.undoCount
  );
}

function isWorkloadOfRecordedIdentity(
  workload: HamiltonianPathSolveWorkload,
  identity: HamiltonianPathRecordedProblemIdentity,
): boolean {
  return (
    !isHamiltonianPathProblemIdentity(identity) ||
    isHamiltonianPathWorkloadOfIdentity(workload, identity)
  );
}

export function isHamiltonianPathPlayRecord(
  record: PlayRecord,
): record is HamiltonianPathPlayRecord {
  if (
    record.gameId !== HAMILTONIAN_PATH_GAME_ID ||
    record.payloadVersion !== HAMILTONIAN_PATH_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isHamiltonianPathRecordedProblemIdentity(problemIdentity) &&
    isHamiltonianPathSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isHamiltonianPathPerformance(performance)
  );
}

/** 記録の値から、記録の項目だけを取り出す。読み戻した記録に余分な項目があっても結果へ持ち込まない。 */
function copyPerformance({
  elapsedMs,
  backtrackCount,
  retractedCellCount,
  undoCount,
  restartCount,
  inputCount,
}: HamiltonianPathSessionResult): HamiltonianPathSessionResult {
  return {
    elapsedMs,
    backtrackCount,
    retractedCellCount,
    undoCount,
    restartCount,
    inputCount,
  };
}

function copyWorkload({
  openCellCount,
  assumptionCount,
  refutationStepCount,
  longestRefutationLength,
  fatalBranchCount,
}: HamiltonianPathSolveWorkload): HamiltonianPathSolveWorkload {
  return {
    openCellCount,
    assumptionCount,
    refutationStepCount,
    longestRefutationLength,
    fatalBranchCount,
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type HamiltonianPathRecordedResult = {
  difficulty: HamiltonianPathDifficulty;
  problemIdentity: HamiltonianPathProblemIdentity;
  result: HamiltonianPathResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreHamiltonianPathRecordedResult(
  record: PlayRecord,
): HamiltonianPathRecordedResult | null {
  if (
    !isHamiltonianPathPlayRecord(record) ||
    !isHamiltonianPathProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createHamiltonianPathResult(
      copyPerformance(performance),
      copyWorkload(workload),
    ),
  };
}

export function createHamiltonianPathPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateHamiltonianPathPlayRecordInput): HamiltonianPathPlayRecord {
  return {
    id: createPlayRecordId([
      HAMILTONIAN_PATH_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: HAMILTONIAN_PATH_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: HAMILTONIAN_PATH_PLAY_RECORD_PAYLOAD_VERSION,
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

export function getHamiltonianPathPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isHamiltonianPathPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateHamiltonianPathPlayScore({
    elapsedMs: performance.elapsedMs,
    backtrackCount: performance.backtrackCount,
    workload,
  }).total;
}

export function getHamiltonianPathPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isHamiltonianPathPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateHamiltonianPathTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type HamiltonianPathPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "backtrack-count";

export const hamiltonianPathPlayRecordDefinition = {
  gameId: HAMILTONIAN_PATH_GAME_ID,
  isRecord: isHamiltonianPathPlayRecord,
  getComparisonKey(record) {
    return isHamiltonianPathPlayRecord(record)
      ? record.payload.difficulty
      : null;
  },
  getClearPerformance(record) {
    return isHamiltonianPathPlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getHamiltonianPathPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getHamiltonianPathPlayRecordTimeDelta,
    },
    {
      id: "backtrack-count",
      direction: "lower",
      getValue(record) {
        return isHamiltonianPathPlayRecord(record)
          ? record.payload.performance.backtrackCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<HamiltonianPathPlayRecordMetricId>;
