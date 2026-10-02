import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessTsumeShogiDifficulty,
  type TsumeShogiDifficulty,
  type TsumeShogiDifficultyAssessment,
} from "@/games/tsume-shogi/difficulty";
import {
  analyzeTsumeShogiDifficulty,
  type TsumeShogiDifficultyFeatures,
} from "@/games/tsume-shogi/problem/difficulty-analysis";
import {
  formatTsumeShogiProblemText,
  isTsumeShogiProblemIdentity,
  type TsumeShogiProblem,
  type TsumeShogiProblemIdentity,
  type TsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import type {
  TsumeShogiPooledProblem,
  TsumeShogiProblemPoolReference,
} from "@/games/tsume-shogi/problem/problem-pool";
import { restoreTsumeShogiProblem } from "@/games/tsume-shogi/problem-selection";
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

/**
 * - `problemPool`: 出題した問題の問題集の版と番号。
 * - `problem`: 初期局面（SFEN）と作意（USI）。人間のレビューで盤面を確かめ、外部の将棋ソフトへ渡せるよう文字列で持つ。
 * - `difficultyFeatures`: 難易度分析の特徴（判断地点ごとの内訳と手筋の数を含む）。分析できない問題では `null`。
 * - `difficultyAssessment`: 特徴の分類。問題集の問題でも分析し直し、問題集のレベルと食い違えば分類の方を見せる。
 */
export type TsumeShogiDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "tsume-shogi",
  TsumeShogiDifficulty,
  TsumeShogiProblemIdentity
> & {
  problemPool: TsumeShogiProblemPoolReference;
  problem: TsumeShogiProblemText;
  difficultyFeatures: TsumeShogiDifficultyFeatures | null;
  difficultyAssessment: TsumeShogiDifficultyAssessment;
};

const difficultyAssessmentStatuses: readonly string[] = [
  "classified",
  "out-of-range",
  "unsupported",
  "invalid",
] satisfies readonly TsumeShogiDifficultyAssessment["status"][];

function isProblemPoolReference(
  value: unknown,
): value is TsumeShogiProblemPoolReference {
  return (
    isRecordObject(value) &&
    isNonEmptyString(value.poolVersion) &&
    isNonEmptyString(value.problemId)
  );
}

function isProblemText(value: unknown): value is TsumeShogiProblemText {
  return (
    isRecordObject(value) &&
    isNonEmptyString(value.sfen) &&
    Array.isArray(value.mainLine) &&
    value.mainLine.every(isNonEmptyString)
  );
}

/** 診断として見せる値なので、分類に使う数と内訳の形だけを確かめる。 */
function isDifficultyFeatures(
  value: unknown,
): value is TsumeShogiDifficultyFeatures {
  return (
    isRecordObject(value) &&
    isNonNegativeInteger(value.rootChecks) &&
    isNonNegativeInteger(value.plausibleWrong) &&
    isNonNegativeInteger(value.deepDecoyCount) &&
    isNonNegativeInteger(value.defenseBranching) &&
    isNonNegativeInteger(value.tesujiKindCount) &&
    Array.isArray(value.decisions) &&
    isRecordObject(value.motifs)
  );
}

function isDifficultyAssessment(
  value: unknown,
): value is TsumeShogiDifficultyAssessment {
  return (
    isRecordObject(value) &&
    typeof value.status === "string" &&
    difficultyAssessmentStatuses.includes(value.status) &&
    (value.status !== "classified" ||
      (typeof value.difficulty === "string" &&
        parseDifficultyLevel(value.difficulty) !== undefined))
  );
}

const tsumeShogiDiagnosticFormat: InternalDiagnosticFormat<TsumeShogiDiagnosticSnapshot> =
  {
    game: "tsume-shogi",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isTsumeShogiProblemIdentity,
    readDetails({
      problemPool,
      problem,
      difficultyFeatures,
      difficultyAssessment,
    }) {
      return isProblemPoolReference(problemPool) &&
        isProblemText(problem) &&
        (difficultyFeatures === null ||
          isDifficultyFeatures(difficultyFeatures)) &&
        isDifficultyAssessment(difficultyAssessment)
        ? { problemPool, problem, difficultyFeatures, difficultyAssessment }
        : undefined;
    },
  };

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置、局面と作意、
 * 難易度の特徴と分類を持つ。難易度分析は5手詰で数秒かかることがあるので、プレイ中には呼ばず検証情報を開いたときだけ呼ぶ。
 */
export function createTsumeShogiDiagnosticSnapshot({
  poolReference,
  problem,
  ...input
}: {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiProblemIdentity;
  poolReference: TsumeShogiProblemPoolReference;
  problem: TsumeShogiProblem;
  buildRevision: string | null;
}): TsumeShogiDiagnosticSnapshot {
  const analysis = analyzeTsumeShogiDifficulty(problem);

  return {
    ...createInternalDiagnosticSnapshot(tsumeShogiDiagnosticFormat, input),
    problemPool: { ...poolReference },
    problem: formatTsumeShogiProblemText(problem),
    difficultyFeatures:
      analysis.status === "analyzed" ? analysis.features : null,
    difficultyAssessment: assessTsumeShogiDifficulty(analysis),
  };
}

function parseTsumeShogiDiagnosticSnapshot(
  serialized: string,
): TsumeShogiDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    tsumeShogiDiagnosticFormat,
  );
}

/** 問題集に無い identity は `null` を返す。 */
function restoreTsumeShogiProblemFromDiagnosticSnapshot(
  snapshot: TsumeShogiDiagnosticSnapshot,
): TsumeShogiPooledProblem | null {
  return restoreTsumeShogiProblem(snapshot.problemIdentity);
}

export const _private = {
  parseTsumeShogiDiagnosticSnapshot,
  restoreTsumeShogiProblemFromDiagnosticSnapshot,
};
