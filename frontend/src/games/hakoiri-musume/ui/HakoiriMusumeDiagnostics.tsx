import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { HakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import {
  type HakoiriMusumeProblem,
  isHakoiriMusumeClassicLayout,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import type { HakoiriMusumePieceKind } from "@/games/hakoiri-musume/puzzle/board";

type HakoiriMusumeDiagnosticsProps = {
  snapshot: HakoiriMusumeDiagnosticSnapshot;
  onClose: () => void;
};

function formatDetourCount(count: number): string {
  return count > HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT
    ? `${HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT + 1}回以上`
    : `${count}回`;
}

/**
 * 問題の駒の組。基準の盤の問題は娘がどれも1つなので、ほかの駒の数を、図鑑の詳しい表示と同じ書き方で並べる。
 * ほかの盤の問題は、盤の大きさ・壁・目標の数と、大駒・L字の数を添える。
 */
function describeProblem({ layout, pieces }: HakoiriMusumeProblem): string {
  const others = pieces.filter((piece) => piece.target === null);
  function countOf(kinds: readonly HakoiriMusumePieceKind[]) {
    return others.filter((piece) => kinds.includes(piece.kind)).length;
  }
  const pieceSet = `横長 ${countOf(["horizontal"])}個 縦長 ${countOf(["vertical"])}個 小駒 ${countOf(["small"])}個`;
  if (isHakoiriMusumeClassicLayout(layout) && countOf(["square"]) === 0) {
    return pieceSet;
  }
  const bends = countOf([
    "bend-up-right",
    "bend-up-left",
    "bend-down-right",
    "bend-down-left",
  ]);
  return `盤 ${layout.columns}×${layout.rows} 壁 ${layout.walls.length}マス 目標 ${layout.goals.length}つ ${pieceSet} 大駒 ${countOf(["square"])}個 L字 ${bends}個`;
}

function listAnalysisItems(
  analysis: HakoiriMusumeDiagnosticSnapshot["difficultyAnalysis"],
) {
  const { features } = analysis;
  const workloadItems = [
    { label: "準備の長さ", value: `${features.preparationLength}手` },
    { label: "空きマス", value: `${features.emptyCellCount}マス` },
    { label: "最短手数", value: `${features.optimalMoveCount}手` },
  ];
  if (analysis.status === "recorded") {
    return [
      {
        label: "値の出どころ",
        value: "記録（問題集に無い問題。記録したときの値）",
      },
      ...workloadItems,
    ];
  }
  return [
    { label: "値の出どころ", value: "問題集（作るときに分析した値）" },
    ...workloadItems,
    {
      label: "最短の解の準備",
      value: `${analysis.features.shortestPreparationLength}手`,
    },
    {
      label: "娘の遠回り",
      value: formatDetourCount(analysis.features.daughterDetourCount),
    },
  ];
}

export function HakoiriMusumeDiagnostics({
  snapshot,
  onClose,
}: HakoiriMusumeDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={describeProblem(
        restoreHakoiriMusumeProblem(snapshot.problemIdentity).problem,
      )}
      buildRevision={snapshot.buildRevision}
      sections={[
        {
          title: "難易度判定",
          items: [
            { label: "分類", value: getDifficultyLabel(snapshot.difficulty) },
            ...listAnalysisItems(snapshot.difficultyAnalysis),
          ],
        },
      ]}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
