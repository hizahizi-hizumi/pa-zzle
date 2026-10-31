import type { GameResultScoreCriterion } from "@/components/GameResultScreen/GameResultDetails";
import { formatScoreReferenceTime } from "@/components/game-result-metrics";
import {
  PLAY_OPERATION_LABELS,
  type PlayOperation,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import type { ScoreItem, SpeedScoreRule } from "@/games/score";
import { formatDurationInWords } from "@/lib/format-elapsed-time";

/** 採点基準の文で数を示すときの単位。 */
type ScoreCriterionUnit = "回" | "手" | "個" | "本" | "台" | "マス" | "色";

/** 1単位ごとに決まった点を減らす減点。 */
export type ScorePenalty = {
  subject: string;
  unit: ScoreCriterionUnit;
  points: number;
};

/** 基準時間の式の1項。決まった時間か、問題の数に1単位あたりの時間を掛けた時間。 */
export type SpeedFormulaTerm =
  | { label: string; durationMs: number }
  | {
      label?: string;
      count: number;
      unit: ScoreCriterionUnit;
      durationMsPerUnit: number;
    };

type LinearScoreCriterionInput = {
  maximum: number;
  /** 満点になる条件。「最短12手」「基準時間01:10以内」など。 */
  fullScoreCondition: string;
  /** 0点になる条件。「24手以上」など。 */
  zeroScoreCondition: string;
  /** 間の点を決めるもの。「クリア手数」など。 */
  basis: string;
};

type SpeedScoreCriterionInput = {
  maximum: number;
  rule: SpeedScoreRule;
  /** 基準時間の式。基準時間が全問で共通なら省く。 */
  formula?: readonly SpeedFormulaTerm[];
  /** 続けて書く補足の文。 */
  notes?: readonly string[];
};

/** 採点基準の文で操作を指す語。操作の共通の呼び名を「」で囲む。 */
export function formatOperationName(operation: PlayOperation): string {
  return `「${PLAY_OPERATION_LABELS[operation]}」`;
}

export function createOperationPenalty(
  operation: PlayOperation,
  points: number,
): ScorePenalty {
  return { subject: formatOperationName(operation), unit: "回", points };
}

export function createScoreItemCriterion(
  item: ScoreItem,
  description: string,
): GameResultScoreCriterion {
  return { label: SCORE_ITEM_LABELS[item], description };
}

/** 満点から減点して採点する項目の基準。 */
export function describePenaltyScoreCriterion(
  maximum: number,
  penalties: readonly ScorePenalty[],
  notes: readonly string[] = [],
): string {
  const penaltyText = penalties
    .map(({ subject, unit, points }) => `${subject}1${unit}につき${points}点`)
    .join("、");
  return [`${maximum}点から、${penaltyText}を減らす。`, ...notes].join("");
}

/** 満点の条件から0点の条件まで、比例して減らす項目の基準。 */
export function describeLinearScoreCriterion(
  {
    maximum,
    fullScoreCondition,
    zeroScoreCondition,
    basis,
  }: LinearScoreCriterionInput,
  notes: readonly string[] = [],
): string {
  return [
    `${fullScoreCondition}で${maximum}点、${zeroScoreCondition}で0点、その間は${basis}に応じて減らす。`,
    ...notes,
  ].join("");
}

function formatSpeedFormulaTerm(term: SpeedFormulaTerm): string {
  if ("durationMs" in term) {
    return `${term.label}${formatDurationInWords(term.durationMs)}`;
  }
  return `${term.label ?? ""}${term.count}${term.unit} × ${formatDurationInWords(term.durationMsPerUnit)}`;
}

/** 基準時間の式。項を「+」でつなぐ。 */
export function formatSpeedFormula(terms: readonly SpeedFormulaTerm[]): string {
  return terms.map(formatSpeedFormulaTerm).join(" + ");
}

/** 速さの基準。基準時間・0点になる時間・減らし方と、基準時間の式を示す。 */
export function describeSpeedScoreCriterion({
  maximum,
  rule,
  formula,
  notes = [],
}: SpeedScoreCriterionInput): string {
  const basis =
    rule.overtimeStepMs === undefined
      ? "時間"
      : `超過時間を${formatDurationInWords(rule.overtimeStepMs)}単位で切り上げた時間`;
  return describeLinearScoreCriterion(
    {
      maximum,
      fullScoreCondition: `基準時間${formatScoreReferenceTime(rule.fullScoreMs)}以内`,
      zeroScoreCondition: `${formatScoreReferenceTime(rule.zeroScoreMs)}以上`,
      basis,
    },
    [
      ...(formula === undefined
        ? []
        : [`基準時間は${formatSpeedFormula(formula)}。`]),
      ...notes,
    ],
  );
}
