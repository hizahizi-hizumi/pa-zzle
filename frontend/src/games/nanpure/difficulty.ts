import type {
  NanpureDifficultyAnalysis,
  NanpureHumanSolveFeatures,
} from "@/games/nanpure/problem/difficulty-analysis";
import type { NanpureTechnique } from "@/games/nanpure/problem/technique";

export const nanpureDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type NanpureDifficulty = (typeof nanpureDifficulties)[number]["id"];

// 3段階（dependency-v1）時代の記録を、旧区分のまま読み込み表示するためだけに残す。
const legacyNanpureDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type LegacyNanpureDifficulty =
  (typeof legacyNanpureDifficulties)[number]["id"];

export type NanpureRecordedDifficulty =
  | NanpureDifficulty
  | LegacyNanpureDifficulty;

export function parseNanpureDifficulty(
  value: string | undefined,
): NanpureDifficulty | undefined {
  return nanpureDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function parseLegacyNanpureDifficulty(
  value: string | undefined,
): LegacyNanpureDifficulty | undefined {
  return legacyNanpureDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function parseNanpureRecordedDifficulty(
  value: string | undefined,
): NanpureRecordedDifficulty | undefined {
  return parseNanpureDifficulty(value) ?? parseLegacyNanpureDifficulty(value);
}

export function getNanpureDifficultyLabel(
  difficulty: NanpureRecordedDifficulty,
): string {
  return (
    [...nanpureDifficulties, ...legacyNanpureDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 分析できるが提供しない。`too-light` は、行・列・ブロックの最後の1マスを埋めるだけで解き終わり、数字の置き場所を探す挑戦が無い。
 * - `unsupported`: 一意解だが、対応した手筋では解き切れず、挑戦の強さを評価できない。
 * - `invalid`: 解が無い、または2つ以上あり、問題として成立しない。
 */
export type NanpureDifficultyAssessment =
  | { status: "classified"; difficulty: NanpureDifficulty }
  | { status: "out-of-range"; reason: "too-light" }
  | { status: "unsupported" }
  | { status: "invalid" };

const difficultyByDeepestTechnique = {
  "full-house": "1",
  "hidden-single-block": "1",
  "hidden-single-line": "2",
  "naked-single": "2",
  "locked-candidates": "3",
  "naked-pair": "4",
  "hidden-pair": "4",
  "naked-triple": "4",
  "hidden-triple": "4",
  "x-wing": "5",
  swordfish: "5",
  "xy-wing": "5",
  "xyz-wing": "5",
} as const satisfies Record<NanpureTechnique, NanpureDifficulty>;

/**
 * 解くのに要った最も深い手筋で難易度を決める。
 * 5: 2〜3本の行・列にまたがる数字の配置（X-Wing・Swordfish）か、3マスの候補のつながり（XY-Wing・XYZ-Wing）を読む。
 * 4: 1つの単位の中で、2〜3マス・2〜3種類の数字の組（ペア・トリプル）を読んで候補を消す。
 * 3: ブロックと行・列の重なりで候補の位置を絞る（ポインティング・クレーミング）。
 * 2: 行・列の中の置き場所か、1マスに入り得る数字を、行・列・ブロックを合わせて読む。
 * 1: ブロックの中で数字の置き場所を探すだけで解ける。
 */
export function classifyNanpureChallengeDifficulty({
  deepestTechnique,
}: NanpureHumanSolveFeatures): NanpureDifficulty {
  return deepestTechnique === null
    ? "1"
    : difficultyByDeepestTechnique[deepestTechnique];
}

function isTooLight({ deepestTechnique }: NanpureHumanSolveFeatures): boolean {
  return deepestTechnique === null || deepestTechnique === "full-house";
}

export function assessNanpureDifficulty(
  analysis: NanpureDifficultyAnalysis,
): NanpureDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed":
      if (isTooLight(analysis.features)) {
        return { status: "out-of-range", reason: "too-light" };
      }
      return {
        status: "classified",
        difficulty: classifyNanpureChallengeDifficulty(analysis.features),
      };
  }
}
