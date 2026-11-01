import type { CSSProperties } from "react";

import {
  PREVIEW_CLUE_BAND,
  toPreviewLength,
} from "@/games/nonogram/ui/NonogramDifficultyPreview/preview-unit";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/** ヒントの欄の1つ分を、隣の欄と外側から空ける幅（マス単位）。 */
const CLUE_INSET = 0.15;
/** ヒントの欄と盤面の間の幅（マス単位）。盤面の外周の線と重ねない。 */
const CLUE_GAP = 0.55;

type PreviewClueBandProps = {
  /** `row` は盤面の左の、行ごとのヒントの欄。`column` は盤面の上の、列ごとのヒントの欄。 */
  axis: "row" | "column";
  length: number;
  /** 連鎖で読んだ行・列の位置。この位置の欄を連鎖の色にする。 */
  readIndices: ReadonlySet<number>;
};

function placeClue(axis: "row" | "column", index: number): CSSProperties {
  const along = toPreviewLength(PREVIEW_CLUE_BAND + index + CLUE_INSET);
  const across = toPreviewLength(CLUE_INSET);
  const thickness = toPreviewLength(PREVIEW_CLUE_BAND - CLUE_INSET - CLUE_GAP);
  const breadth = toPreviewLength(1 - CLUE_INSET * 2);
  return axis === "row"
    ? { left: across, top: along, width: thickness, height: breadth }
    : { top: across, left: along, height: thickness, width: breadth };
}

/** 盤面の左（行）または上（列）のヒントの欄。数字は描かず、1行・1列ごとの印だけを並べる。 */
export function PreviewClueBand({
  axis,
  length,
  readIndices,
}: PreviewClueBandProps) {
  return Array.from({ length }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: 行・列の位置で決まる
      key={index}
      className={cn(
        "absolute",
        readIndices.has(index)
          ? nonogramToneClassNames.previewChain
          : nonogramToneClassNames.gridLineSurface,
      )}
      style={placeClue(axis, index)}
    />
  ));
}
