import {
  parseTsumeShogiDifficulty,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import {
  isTsumeShogiProblemIdentity,
  isTsumeShogiRecordedProblemIdentity,
  isTsumeShogiSolveWorkload,
  isTsumeShogiWorkloadOfIdentity,
  type TsumeShogiProblemIdentity,
  type TsumeShogiRecordedProblemIdentity,
  type TsumeShogiSolveWorkload,
} from "@/games/tsume-shogi/problem/problem";
import type { TsumeShogiProblemPoolReference } from "@/games/tsume-shogi/problem/problem-pool";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiTimeDeltaMs,
} from "@/games/tsume-shogi/score";
import type { TsumeShogiSessionResult } from "@/games/tsume-shogi/session/session";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const TSUME_SHOGI_GAME_ID = "tsume-shogi";
const TSUME_SHOGI_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `poolReference`: 遊んだときの問題集の版と問題番号。問題集を作り直すと別の問題を指すので再プレイには使わず、
 *   記録がどの問題集から出たかを後から確かめるためだけに残す。
 * - `workload`: 遊んだ問題を読み切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 *   反証を見た回数・判断地点へ戻った回数・元に戻した回数・盤面を戻した回数・非合法入力の回数・入力回数は評価に使わないが、
 *   評価規則や操作の摩擦を見直すときの材料として残す。
 */
type TsumeShogiPlayRecordPayload = {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiRecordedProblemIdentity;
  poolReference: TsumeShogiProblemPoolReference;
  workload: TsumeShogiSolveWorkload;
  performance: TsumeShogiSessionResult;
};

export type TsumeShogiPlayRecord = PlayRecord & {
  gameId: typeof TSUME_SHOGI_GAME_ID;
  payloadVersion: typeof TSUME_SHOGI_PLAY_RECORD_PAYLOAD_VERSION;
  payload: TsumeShogiPlayRecordPayload;
};

type CreateTsumeShogiPlayRecordInput = {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiProblemIdentity;
  poolReference: TsumeShogiProblemPoolReference;
  workload: TsumeShogiSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: TsumeShogiSessionResult;
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPoolReference(
  value: unknown,
): value is TsumeShogiProblemPoolReference {
  return (
    isRecordObject(value) &&
    isNonEmptyString(value.poolVersion) &&
    isNonEmptyString(value.problemId)
  );
}

/**
 * 誤王手と非合法入力はそれぞれ別の入力で起きるので、合わせて入力回数を超えない。
 * 判断地点へ戻るのは誤王手の筋にいるときだけなので、戻ったことがあれば誤王手も1回以上ある（同じ誤王手を指し直して
 * 戻っても誤王手は1回だけ数えるので、戻った回数は誤王手の回数を超えうる）。
 */
function isTsumeShogiPerformance(
  value: unknown,
): value is TsumeShogiSessionResult {
  return (
    isRecordObject(value) &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    isNonNegativeInteger(value.wrongCheckCount) &&
    isNonNegativeInteger(value.refutationViewCount) &&
    isNonNegativeInteger(value.returnCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.illegalInputCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.wrongCheckCount + value.illegalInputCount <= value.inputCount &&
    (value.returnCount === 0 || value.wrongCheckCount > 0)
  );
}

function isWorkloadOfRecordedIdentity(
  workload: TsumeShogiSolveWorkload,
  identity: TsumeShogiRecordedProblemIdentity,
): boolean {
  return (
    !isTsumeShogiProblemIdentity(identity) ||
    isTsumeShogiWorkloadOfIdentity(workload, identity)
  );
}

export function isTsumeShogiPlayRecord(
  record: PlayRecord,
): record is TsumeShogiPlayRecord {
  if (
    record.gameId !== TSUME_SHOGI_GAME_ID ||
    record.payloadVersion !== TSUME_SHOGI_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, poolReference, workload, performance } =
    record.payload;
  return (
    typeof difficulty === "string" &&
    parseTsumeShogiDifficulty(difficulty) !== undefined &&
    isTsumeShogiRecordedProblemIdentity(problemIdentity) &&
    isPoolReference(poolReference) &&
    isTsumeShogiSolveWorkload(workload) &&
    isWorkloadOfRecordedIdentity(workload, problemIdentity) &&
    isTsumeShogiPerformance(performance)
  );
}

export function createTsumeShogiPlayRecord({
  difficulty,
  problemIdentity,
  poolReference,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateTsumeShogiPlayRecordInput): TsumeShogiPlayRecord {
  const { rootChecks } = problemIdentity.conditions;
  return {
    id: createPlayRecordId([
      TSUME_SHOGI_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: TSUME_SHOGI_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: TSUME_SHOGI_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        generatorVersion: problemIdentity.generatorVersion,
        seed: problemIdentity.seed,
        conditions: {
          plies: problemIdentity.conditions.plies,
          ...(rootChecks === undefined
            ? {}
            : { rootChecks: { ...rootChecks } }),
        },
      },
      poolReference: {
        poolVersion: poolReference.poolVersion,
        problemId: poolReference.problemId,
      },
      workload: {
        plies: workload.plies,
        rootChecks: workload.rootChecks,
        plausibleWrong: workload.plausibleWrong,
        deepDecoyCount: workload.deepDecoyCount,
      },
      performance: {
        elapsedMs: result.elapsedMs,
        wrongCheckCount: result.wrongCheckCount,
        refutationViewCount: result.refutationViewCount,
        returnCount: result.returnCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        illegalInputCount: result.illegalInputCount,
        inputCount: result.inputCount,
      },
    },
  };
}

export function getTsumeShogiPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isTsumeShogiPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateTsumeShogiPlayScore({
    elapsedMs: performance.elapsedMs,
    wrongCheckCount: performance.wrongCheckCount,
    workload,
  }).total;
}

export function getTsumeShogiPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isTsumeShogiPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateTsumeShogiTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export function getTsumeShogiPlayRecordWrongCheckCount(
  record: PlayRecord,
): number | null {
  return isTsumeShogiPlayRecord(record)
    ? record.payload.performance.wrongCheckCount
    : null;
}

export type TsumeShogiPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "wrong-check-count";

export const tsumeShogiPlayRecordDefinition = {
  gameId: TSUME_SHOGI_GAME_ID,
  isRecord: isTsumeShogiPlayRecord,
  getComparisonKey(record) {
    return isTsumeShogiPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getTsumeShogiPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getTsumeShogiPlayRecordTimeDelta,
    },
    {
      id: "wrong-check-count",
      direction: "lower",
      getValue: getTsumeShogiPlayRecordWrongCheckCount,
    },
  ],
} satisfies PlayRecordDefinition<TsumeShogiPlayRecordMetricId>;
