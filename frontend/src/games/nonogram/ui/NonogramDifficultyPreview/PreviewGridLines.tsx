import { NONOGRAM_GRID_BLOCK_SIZE } from "@/games/nonogram/ui/grid-block";
import { toPreviewLength } from "@/games/nonogram/ui/NonogramDifficultyPreview/preview-unit";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type PreviewGridLinesProps = {
  /** 盤面の列の数。 */
  width: number;
  /** 盤面の行の数。 */
  height: number;
};

/** マスの内側の境界のうち、5マスごとの境界の位置（マス単位）。 */
function listBlockBoundaries(length: number): number[] {
  return Array.from({ length: length - 1 }, (_, index) => index + 1).filter(
    (offset) => offset % NONOGRAM_GRID_BLOCK_SIZE === 0,
  );
}

/** 盤面の5マスごとの線。マスごとの細い線は描かず、盤面の広さを数えられる区切りだけを残す。 */
export function PreviewGridLines({ width, height }: PreviewGridLinesProps) {
  return [
    ...listBlockBoundaries(width).map((column) => (
      <span
        key={`column-${column}`}
        className={cn(
          "absolute inset-y-0 border-l",
          nonogramToneClassNames.blockLine,
        )}
        style={{ left: toPreviewLength(column) }}
      />
    )),
    ...listBlockBoundaries(height).map((row) => (
      <span
        key={`row-${row}`}
        className={cn(
          "absolute inset-x-0 border-t",
          nonogramToneClassNames.blockLine,
        )}
        style={{ top: toPreviewLength(row) }}
      />
    )),
  ];
}
