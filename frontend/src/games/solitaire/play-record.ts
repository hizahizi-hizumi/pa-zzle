import {
  createPlayRecordId,
  type PlayRecord,
} from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import {
  createSolitaireResult,
  type SolitaireResult,
} from "@/games/solitaire/play/use-solitaire-play";
import {
  isCurrentSolitaireProblemIdentity,
  isSolitaireRecordedProblemIdentity,
  type SolitaireProblemIdentity,
  type SolitaireRecordedProblemIdentity,
} from "@/games/solitaire/problem/problem";
import { SOLITAIRE_CARD_COUNT } from "@/games/solitaire/puzzle/card";
import {
  calculateSolitairePlayScore,
  calculateSolitaireTimeDeltaMs,
} from "@/games/solitaire/score";
import type { SolitaireSessionResult } from "@/games/solitaire/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

const SOLITAIRE_GAME_ID = "solitaire";
const SOLITAIRE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type SolitairePlayPerformance = SolitaireSessionResult;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準との差は保存せず、現在の評価規則で導出する。
 */
type SolitairePlayRecordPayload = {
  difficulty: SolitaireDifficulty;
  problemIdentity: SolitaireRecordedProblemIdentity;
  performance: SolitairePlayPerformance;
};

type SolitairePlayRecord = PlayRecord & {
  gameId: typeof SOLITAIRE_GAME_ID;
  payloadVersion: typeof SOLITAIRE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: SolitairePlayRecordPayload;
};

type CreateSolitairePlayRecordInput = {
  difficulty: SolitaireDifficulty;
  problemIdentity: SolitaireProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: SolitairePlayPerformance;
};

/** 待ったは打った1手を取り消すので、打った手の数を超えない。クリアには組札へ送る52手が要る。 */
function isSolitairePerformance(
  value: unknown,
): value is SolitairePlayPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isPositiveInteger(value.moveCount) &&
    value.moveCount >= SOLITAIRE_CARD_COUNT &&
    isNonNegativeInteger(value.undoCount) &&
    value.undoCount <= value.moveCount &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.retractedMoveCount) &&
    value.retractedMoveCount <= value.moveCount
  );
}

export function isSolitairePlayRecord(
  record: PlayRecord,
): record is SolitairePlayRecord {
  if (
    record.gameId !== SOLITAIRE_GAME_ID ||
    record.payloadVersion !== SOLITAIRE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isSolitaireRecordedProblemIdentity(problemIdentity) &&
    isSolitairePerformance(performance)
  );
}

export function createSolitairePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateSolitairePlayRecordInput): SolitairePlayRecord {
  return {
    id: createPlayRecordId([
      SOLITAIRE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: SOLITAIRE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: SOLITAIRE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        moveCount: result.moveCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        retractedMoveCount: result.retractedMoveCount,
      },
    },
  };
}

export type SolitaireRecordedResult = {
  difficulty: SolitaireDifficulty;
  problemIdentity: SolitaireProblemIdentity;
  result: SolitaireResult;
};

/** 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。 */
export function restoreSolitaireRecordedResult(
  record: PlayRecord,
): SolitaireRecordedResult | null {
  if (
    !isSolitairePlayRecord(record) ||
    !isCurrentSolitaireProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createSolitaireResult(performance),
  };
}

function getSolitairePlayRecordScore(record: PlayRecord): number | null {
  return isSolitairePlayRecord(record)
    ? calculateSolitairePlayScore(record.payload.performance).total
    : null;
}

function getSolitairePlayRecordTimeDelta(record: PlayRecord): number | null {
  return isSolitairePlayRecord(record)
    ? calculateSolitaireTimeDeltaMs(record.payload.performance.elapsedMs)
    : null;
}

export type SolitairePlayRecordMetricId = "play-score" | "time-delta-ms";

export const solitairePlayRecordDefinition = {
  gameId: SOLITAIRE_GAME_ID,
  isRecord: isSolitairePlayRecord,
  getComparisonKey(record) {
    return isSolitairePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isSolitairePlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getSolitairePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getSolitairePlayRecordTimeDelta,
    },
  ],
} satisfies PlayRecordDefinition<SolitairePlayRecordMetricId>;

export const _private = {
  getSolitairePlayRecordScore,
  getSolitairePlayRecordTimeDelta,
};
