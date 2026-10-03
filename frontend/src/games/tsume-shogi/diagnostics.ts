import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
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
  copyTsumeShogiGenerationConditions,
  formatTsumeShogiProblemText,
  type TsumeShogiProblem,
  type TsumeShogiProblemIdentity,
  type TsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import type { TsumeShogiProblemPoolReference } from "@/games/tsume-shogi/problem/problem-pool";

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

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置、局面と作意、
 * 難易度の特徴と分類を持つ。難易度分析は5手詰で数秒かかることがあるので、プレイ中には呼ばず検証情報を開いたときだけ呼ぶ。
 */
export function createTsumeShogiDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  poolReference,
  problem,
  buildRevision,
}: {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiProblemIdentity;
  poolReference: TsumeShogiProblemPoolReference;
  problem: TsumeShogiProblem;
  buildRevision: string | null;
}): TsumeShogiDiagnosticSnapshot {
  const analysis = analyzeTsumeShogiDifficulty(problem);
  const { conditions } = problemIdentity;

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "tsume-shogi",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: copyTsumeShogiGenerationConditions(conditions),
    },
    problemPool: { ...poolReference },
    problem: formatTsumeShogiProblemText(problem),
    difficultyFeatures:
      analysis.status === "analyzed" ? analysis.features : null,
    difficultyAssessment: assessTsumeShogiDifficulty(analysis),
    buildRevision,
  };
}
