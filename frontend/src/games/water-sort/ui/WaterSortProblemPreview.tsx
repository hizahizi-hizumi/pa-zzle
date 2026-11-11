import type { CSSProperties } from "react";

import type { WaterSortProblem } from "@/games/water-sort/problem/problem";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";

type WaterSortProblemPreviewProps = {
  problem: WaterSortProblem;
};

/**
 * 幅 390px のスマートフォンのプレイ画面での、盤面を置く幅（左右の余白を除く）。
 * ボトルの間・段の間・ボトルの角丸は px・rem で決まっていてボトルの幅に連れて縮まないので、この大きさの正方形に並べてから全体を縮め、
 * 小さな枠でもプレイ画面と同じ釣り合いに見せる。
 */
const PREVIEW_LAYOUT_SIZE_PX = 366;

const previewLayoutStyle = {
  width: `${PREVIEW_LAYOUT_SIZE_PX}px`,
  height: `${PREVIEW_LAYOUT_SIZE_PX}px`,
  // tan(atan2(a, b)) は長さどうしの比 a / b を数として求める。置かれた枠（`container-type: size`）に収まる倍率にする。
  scale: `min(tan(atan2(100cqw, ${PREVIEW_LAYOUT_SIZE_PX}px)), tan(atan2(100cqh, ${PREVIEW_LAYOUT_SIZE_PX}px)))`,
} satisfies CSSProperties;

function ignoreBottleSelection() {}

/** 1問の、始めたときのボトルの並び。プレイ画面と同じ2段の並びを、置かれた枠に収まる大きさで中央に描く。操作は受けない。 */
export function WaterSortProblemPreview({
  problem,
}: WaterSortProblemPreviewProps) {
  return (
    <div className="shrink-0" style={previewLayoutStyle}>
      <WaterSortBoard
        state={problem.initialState}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={ignoreBottleSelection}
        interactionDisabled
      />
    </div>
  );
}
