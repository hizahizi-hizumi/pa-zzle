import {
  createPlayRecordId,
  type PlayRecord,
} from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  createMagicSquareResult,
  type MagicSquareResult,
} from "@/games/magic-square/play/use-magic-square-play";
import {
  isCurrentMagicSquareProblemIdentity,
  isMagicSquareRecordedProblemIdentity,
  isMagicSquareSolveWorkload,
  type MagicSquareProblemIdentity,
  type MagicSquareRecordedProblemIdentity,
  type MagicSquareSolveWorkload,
} from "@/games/magic-square/problem/problem";
import {
  calculateMagicSquarePlayScore,
  calculateMagicSquareTimeDeltaMs,
} from "@/games/magic-square/score";
import type { MagicSquareSessionResult } from "@/games/magic-square/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

const MAGIC_SQUARE_GAME_ID = "magic-square";
const MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION = 3;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 問題集から外れても速さを評価できるよう残す、問題の作業の量。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準との差は保存せず、今の評価規則で導出する。
 */
type MagicSquarePlayRecordPayload = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareRecordedProblemIdentity;
  workload: MagicSquareSolveWorkload;
  performance: MagicSquareSessionResult;
};

export type MagicSquarePlayRecord = PlayRecord & {
  gameId: typeof MAGIC_SQUARE_GAME_ID;
  payloadVersion: typeof MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: MagicSquarePlayRecordPayload;
};

// 前の版の置き直しは、今の置き直しと数え方が違うので、記録一覧と時間の自己ベストに残し、評価点・置き直しの自己ベスト・図鑑には使わず、
// 結果画面も作り直さない。
// - payloadVersion 1 の `withdrawalCount`: 同じマスでほかのマスに触れる前に直した数を、盤面の知らせを見てから直したものも含めて
//   数えなかった。
// - payloadVersion 2 の `correctionCount`: 同じマスを変えている間は最後に残った数で数え直し（元の数に戻すと減る）、列の見え方を
//   変えた最初の数を数の欄で隣り合う数へ直した1回も数えなかった。
type MagicSquarePerformanceV1 = Omit<
  MagicSquareSessionResult,
  "correctionCount"
> & {
  withdrawalCount: number;
};

type MagicSquarePlayRecordV1 = PlayRecord & {
  gameId: typeof MAGIC_SQUARE_GAME_ID;
  payloadVersion: 1;
  payload: Omit<MagicSquarePlayRecordPayload, "performance"> & {
    performance: MagicSquarePerformanceV1;
  };
};

type MagicSquarePlayRecordV2 = Omit<MagicSquarePlayRecord, "payloadVersion"> & {
  payloadVersion: 2;
};

type RecognizedMagicSquarePlayRecord =
  | MagicSquarePlayRecordV1
  | MagicSquarePlayRecordV2
  | MagicSquarePlayRecord;

type CreateMagicSquarePlayRecordInput = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareProblemIdentity;
  workload: MagicSquareSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: MagicSquareSessionResult;
};

/** 置き直しの回数の項目は、版 1 では `withdrawalCount`、版 2 と今の版では `correctionCount`。 */
function isMagicSquarePerformance(
  value: unknown,
  payloadVersion: number,
): boolean {
  if (!isRecordObject(value)) {
    return false;
  }
  const correctionCount =
    payloadVersion === 1
      ? value.withdrawalCount
      : payloadVersion === 2 ||
          payloadVersion === MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION
        ? value.correctionCount
        : undefined;
  return (
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(correctionCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount)
  );
}

function copyPerformance({
  elapsedMs,
  correctionCount,
  undoCount,
  restartCount,
}: MagicSquareSessionResult): MagicSquareSessionResult {
  return { elapsedMs, correctionCount, undoCount, restartCount };
}

function copyWorkload({
  emptyCellCount,
}: MagicSquareSolveWorkload): MagicSquareSolveWorkload {
  return { emptyCellCount };
}

/** 前の版を含め、読み込める記録か。今の版かは `isCurrentMagicSquarePlayRecord` で確かめる。 */
export function isMagicSquarePlayRecord(
  record: PlayRecord,
): record is RecognizedMagicSquarePlayRecord {
  if (
    record.gameId !== MAGIC_SQUARE_GAME_ID ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isMagicSquareRecordedProblemIdentity(problemIdentity) &&
    isMagicSquareSolveWorkload(workload) &&
    isMagicSquarePerformance(performance, record.payloadVersion)
  );
}

function isCurrentMagicSquarePlayRecord(
  record: PlayRecord,
): record is MagicSquarePlayRecord {
  return (
    isMagicSquarePlayRecord(record) &&
    record.payloadVersion === MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION
  );
}

export function createMagicSquarePlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateMagicSquarePlayRecordInput): MagicSquarePlayRecord {
  return {
    id: createPlayRecordId([
      MAGIC_SQUARE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: MAGIC_SQUARE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION,
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

export type MagicSquareRecordedResult = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareProblemIdentity;
  result: MagicSquareResult;
};

/** 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。 */
export function restoreMagicSquareRecordedResult(
  record: PlayRecord,
): MagicSquareRecordedResult | null {
  if (
    !isCurrentMagicSquarePlayRecord(record) ||
    !isCurrentMagicSquareProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createMagicSquareResult(
      copyPerformance(performance),
      copyWorkload(workload),
    ),
  };
}

function getMagicSquarePlayRecordScore(record: PlayRecord): number | null {
  if (!isCurrentMagicSquarePlayRecord(record)) {
    return null;
  }
  const { workload, performance } = record.payload;
  return calculateMagicSquarePlayScore({ ...performance, workload }).total;
}

function getMagicSquarePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isMagicSquarePlayRecord(record)) {
    return null;
  }
  const { workload, performance } = record.payload;
  return calculateMagicSquareTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type MagicSquarePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "correction-count";

export const magicSquarePlayRecordDefinition = {
  gameId: MAGIC_SQUARE_GAME_ID,
  isRecord: isMagicSquarePlayRecord,
  getComparisonKey(record) {
    return isMagicSquarePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isMagicSquarePlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getMagicSquarePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getMagicSquarePlayRecordTimeDelta,
    },
    {
      id: "correction-count",
      direction: "lower",
      getValue(record) {
        return isCurrentMagicSquarePlayRecord(record)
          ? record.payload.performance.correctionCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<MagicSquarePlayRecordMetricId>;

export const _private = {
  getMagicSquarePlayRecordScore,
  getMagicSquarePlayRecordTimeDelta,
};
