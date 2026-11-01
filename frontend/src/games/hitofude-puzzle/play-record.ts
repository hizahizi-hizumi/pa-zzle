import { parseDifficultyLevel } from "@/games/difficulty";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  createHitofudePuzzleResult,
  type HitofudePuzzleResult,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import {
  type HitofudePuzzleProblemIdentity,
  type HitofudePuzzleRecordedProblemIdentity,
  type HitofudePuzzleSolveWorkload,
  isHitofudePuzzleProblemIdentity,
  isHitofudePuzzleRecordedProblemIdentity,
  isHitofudePuzzleSolveWorkload,
  isHitofudePuzzleWorkloadOfIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  calculateHitofudePuzzlePlayScore,
  calculateHitofudePuzzleTimeDeltaMs,
} from "@/games/hitofude-puzzle/score";
import type { HitofudePuzzleSessionResult } from "@/games/hitofude-puzzle/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const HITOFUDE_PUZZLE_GAME_ID = "hitofude-puzzle";
const HITOFUDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   戻したマスの数・待った・盤面を戻した回数・入力回数は評価に使わないが、評価規則を見直すときの材料として残す。
 */
type HitofudePuzzlePlayRecordPayload = {
  difficulty: HitofudePuzzleDifficulty;
  problemIdentity: HitofudePuzzleRecordedProblemIdentity;
  workload: HitofudePuzzleSolveWorkload;
  performance: HitofudePuzzleSessionResult;
};

export type HitofudePuzzlePlayRecord = PlayRecord & {
  gameId: typeof HITOFUDE_PUZZLE_GAME_ID;
  payloadVersion: typeof HITOFUDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: HitofudePuzzlePlayRecordPayload;
};

type CreateHitofudePuzzlePlayRecordInput = {
  difficulty: HitofudePuzzleDifficulty;
  problemIdentity: HitofudePuzzleProblemIdentity;
  workload: HitofudePuzzleSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: HitofudePuzzleSessionResult;
};

/**
 * 待ったは入力1回ぶんを取り消すので、入力回数を超えない。
 * 引き直しは入力か待ったで道を変えたときに高々1回ずつ数えるので、その合計を超えない。
 */
function isHitofudePuzzlePerformance(
  value: unknown,
): value is HitofudePuzzleSessionResult {
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
  workload: HitofudePuzzleSolveWorkload,
  identity: HitofudePuzzleRecordedProblemIdentity,
): boolean {
  return (
    !isHitofudePuzzleProblemIdentity(identity) ||
    isHitofudePuzzleWorkloadOfIdentity(workload, identity)
  );
}

export function isHitofudePuzzlePlayRecord(
  record: PlayRecord,
): record is HitofudePuzzlePlayRecord {
  if (
    record.gameId !== HITOFUDE_PUZZLE_GAME_ID ||
    record.payloadVersion !== HITOFUDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isHitofudePuzzleRecordedProblemIdentity(problemIdentity) &&
    isHitofudePuzzleSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isHitofudePuzzlePerformance(performance)
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
}: HitofudePuzzleSessionResult): HitofudePuzzleSessionResult {
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
}: HitofudePuzzleSolveWorkload): HitofudePuzzleSolveWorkload {
  return {
    openCellCount,
    assumptionCount,
    refutationStepCount,
    longestRefutationLength,
    fatalBranchCount,
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type HitofudePuzzleRecordedResult = {
  difficulty: HitofudePuzzleDifficulty;
  problemIdentity: HitofudePuzzleProblemIdentity;
  result: HitofudePuzzleResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreHitofudePuzzleRecordedResult(
  record: PlayRecord,
): HitofudePuzzleRecordedResult | null {
  if (
    !isHitofudePuzzlePlayRecord(record) ||
    !isHitofudePuzzleProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createHitofudePuzzleResult(
      copyPerformance(performance),
      copyWorkload(workload),
    ),
  };
}

export function createHitofudePuzzlePlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateHitofudePuzzlePlayRecordInput): HitofudePuzzlePlayRecord {
  return {
    id: createPlayRecordId([
      HITOFUDE_PUZZLE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: HITOFUDE_PUZZLE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: HITOFUDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION,
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

export function getHitofudePuzzlePlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isHitofudePuzzlePlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateHitofudePuzzlePlayScore({
    elapsedMs: performance.elapsedMs,
    backtrackCount: performance.backtrackCount,
    workload,
  }).total;
}

export function getHitofudePuzzlePlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isHitofudePuzzlePlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateHitofudePuzzleTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type HitofudePuzzlePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "backtrack-count";

export const hitofudePuzzlePlayRecordDefinition = {
  gameId: HITOFUDE_PUZZLE_GAME_ID,
  isRecord: isHitofudePuzzlePlayRecord,
  getComparisonKey(record) {
    return isHitofudePuzzlePlayRecord(record)
      ? record.payload.difficulty
      : null;
  },
  getClearPerformance(record) {
    return isHitofudePuzzlePlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getHitofudePuzzlePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getHitofudePuzzlePlayRecordTimeDelta,
    },
    {
      id: "backtrack-count",
      direction: "lower",
      getValue(record) {
        return isHitofudePuzzlePlayRecord(record)
          ? record.payload.performance.backtrackCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<HitofudePuzzlePlayRecordMetricId>;
