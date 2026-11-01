import { parseDifficultyLevel } from "@/games/difficulty";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  createNonogramResult,
  type NonogramResult,
} from "@/games/nonogram/play/use-nonogram-play";
import {
  isNonogramProblemIdentity,
  isNonogramRecordedProblemIdentity,
  isNonogramSolveWorkload,
  type NonogramProblemIdentity,
  type NonogramRecordedProblemIdentity,
  type NonogramSolveWorkload,
} from "@/games/nonogram/problem/problem";
import {
  calculateNonogramPlayScore,
  calculateNonogramTimeDeltaMs,
} from "@/games/nonogram/score";
import type { NonogramSessionResult } from "@/games/nonogram/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const NONOGRAM_GAME_ID = "nonogram";
const NONOGRAM_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   評価に使わない事実（× の付け外し・待った・盤面を戻した回数・入力の回数）も、評価規則を見直せるよう残す。
 */
type NonogramPlayRecordPayload = {
  difficulty: NonogramDifficulty;
  problemIdentity: NonogramRecordedProblemIdentity;
  workload: NonogramSolveWorkload;
  performance: NonogramSessionResult;
};

export type NonogramPlayRecord = PlayRecord & {
  gameId: typeof NONOGRAM_GAME_ID;
  payloadVersion: typeof NONOGRAM_PLAY_RECORD_PAYLOAD_VERSION;
  payload: NonogramPlayRecordPayload;
};

type CreateNonogramPlayRecordInput = {
  difficulty: NonogramDifficulty;
  problemIdentity: NonogramProblemIdentity;
  workload: NonogramSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: NonogramSessionResult;
};

/** 待ったは1回ごとに1回の入力を取り消すので、入力の回数を超えない。 */
function isNonogramPerformance(value: unknown): value is NonogramSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.repaintCount) &&
    isNonNegativeInteger(value.crossToggleCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.undoCount <= value.inputCount
  );
}

export function isNonogramPlayRecord(
  record: PlayRecord,
): record is NonogramPlayRecord {
  if (
    record.gameId !== NONOGRAM_GAME_ID ||
    record.payloadVersion !== NONOGRAM_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isNonogramRecordedProblemIdentity(problemIdentity) &&
    isNonogramSolveWorkload(workload) &&
    isNonogramPerformance(performance)
  );
}

/** 記録から作り直した、結果画面に出す内容。 */
export type NonogramRecordedResult = {
  difficulty: NonogramDifficulty;
  problemIdentity: NonogramProblemIdentity;
  result: NonogramResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreNonogramRecordedResult(
  record: PlayRecord,
): NonogramRecordedResult | null {
  if (
    !isNonogramPlayRecord(record) ||
    !isNonogramProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createNonogramResult(performance, workload),
  };
}

export function createNonogramPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateNonogramPlayRecordInput): NonogramPlayRecord {
  return {
    id: createPlayRecordId([
      NONOGRAM_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: NONOGRAM_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: NONOGRAM_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      workload: {
        width: workload.width,
        height: workload.height,
        filledCellCount: workload.filledCellCount,
        roundCount: workload.roundCount,
      },
      performance: {
        elapsedMs: result.elapsedMs,
        repaintCount: result.repaintCount,
        crossToggleCount: result.crossToggleCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        inputCount: result.inputCount,
      },
    },
  };
}

export function getNonogramPlayRecordScore(record: PlayRecord): number | null {
  if (!isNonogramPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateNonogramPlayScore({ ...performance, workload }).total;
}

export function getNonogramPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isNonogramPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateNonogramTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type NonogramPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "repaint-count";

export const nonogramPlayRecordDefinition = {
  gameId: NONOGRAM_GAME_ID,
  isRecord: isNonogramPlayRecord,
  getComparisonKey(record) {
    return isNonogramPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getNonogramPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getNonogramPlayRecordTimeDelta,
    },
    {
      id: "repaint-count",
      direction: "lower",
      getValue(record) {
        return isNonogramPlayRecord(record)
          ? record.payload.performance.repaintCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<NonogramPlayRecordMetricId>;
