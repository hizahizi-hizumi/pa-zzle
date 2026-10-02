import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { TsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficultyAssessment,
} from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiDifficultyFeatures } from "@/games/tsume-shogi/problem/difficulty-analysis";
import type {
  TsumeShogiBaseKingArea,
  TsumeShogiBaseMate,
  TsumeShogiGenerationConditions,
} from "@/games/tsume-shogi/problem/problem";
import type { TsumeShogiProblemPoolReference } from "@/games/tsume-shogi/problem/problem-pool";

type TsumeShogiDiagnosticsProps = {
  snapshot: TsumeShogiDiagnosticSnapshot;
  onClose: () => void;
};

const baseMateLabels = {
  "board-move": "盤上の駒を動かす1手詰から",
} as const satisfies Record<TsumeShogiBaseMate, string>;

const baseKingAreaLabels = {
  middle: "盤の中ほどの玉から",
} as const satisfies Record<TsumeShogiBaseKingArea, string>;

function formatGenerationConditions({
  plies,
  rootChecks,
  baseMate,
  baseKingArea,
}: TsumeShogiGenerationConditions): string {
  return [
    `${plies}手`,
    ...(rootChecks === undefined
      ? []
      : [`初手の王手 ${rootChecks.minimum}〜${rootChecks.maximum}`]),
    ...(baseMate === undefined ? [] : [baseMateLabels[baseMate]]),
    ...(baseKingArea === undefined ? [] : [baseKingAreaLabels[baseKingArea]]),
  ].join(" / ");
}

function formatProblemPool(
  problemPool: TsumeShogiProblemPoolReference,
): string {
  return `v${problemPool.poolVersion} / ${problemPool.problemId}`;
}

function formatAssessment(assessment: TsumeShogiDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return getTsumeShogiDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return assessment.reason === "mate-in-one"
        ? "提供範囲外（1手詰）"
        : "提供範囲外（組み合わせ外）";
    case "unsupported":
      return "評価不能";
    case "invalid":
      return "問題として不成立";
  }
}

/** 判断地点ごとの「王手 / もっともらしい誤王手 / 深い紛れ」を、残りの手数の多い順（初手から）に並べる。 */
function formatDecisions(
  decisions: TsumeShogiDifficultyFeatures["decisions"],
): string {
  return decisions
    .map(
      ({ remainingPlies, checkCount, plausibleWrongCount, deepDecoyCount }) =>
        `残${remainingPlies}: ${checkCount}/${plausibleWrongCount}/${deepDecoyCount}`,
    )
    .join(", ");
}

function listFeatures(
  features: TsumeShogiDifficultyFeatures | null,
): InternalDiagnosticSection["items"] {
  if (!features) {
    return [{ label: "特徴", value: "分析できない" }];
  }
  return [
    {
      label: "王手/紛れ/深",
      value: `${features.rootChecks} / ${features.plausibleWrong} / ${features.deepDecoyCount}`,
      mono: true,
    },
    {
      label: "変化/手筋",
      value: `${features.defenseBranching} / ${features.tesujiKindCount}`,
      mono: true,
    },
    {
      label: "判断地点",
      value: formatDecisions(features.decisions),
      mono: true,
    },
  ];
}

function listSections({
  problemPool,
  problem,
  difficultyFeatures,
  difficultyAssessment,
}: TsumeShogiDiagnosticSnapshot): InternalDiagnosticSection[] {
  return [
    {
      title: "問題集と分類",
      items: [
        { label: "問題集", value: formatProblemPool(problemPool), mono: true },
        { label: "分類", value: formatAssessment(difficultyAssessment) },
        ...listFeatures(difficultyFeatures),
      ],
    },
    {
      title: "局面と作意",
      items: [
        { label: "SFEN", value: problem.sfen, mono: true, breakAll: true },
        {
          label: "作意",
          value: problem.mainLine.join(" "),
          mono: true,
          breakAll: true,
        },
      ],
    },
  ];
}

export function TsumeShogiDiagnostics({
  snapshot,
  onClose,
}: TsumeShogiDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getTsumeShogiDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={formatGenerationConditions(
        snapshot.problemIdentity.conditions,
      )}
      buildRevision={snapshot.buildRevision}
      sections={listSections(snapshot)}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
