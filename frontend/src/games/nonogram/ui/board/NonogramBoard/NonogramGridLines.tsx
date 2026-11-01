import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramGridLinesProps = NonogramGridSize & {
  /** クリアして図柄を見せている。格子を消す。 */
  revealed: boolean;
};

/** 位置を数えやすくするため、この数のマスごとに太い線を引く。 */
const BLOCK_SIZE = 5;

function listInnerOffsets(count: number): number[] {
  return Array.from({ length: count - 1 }, (_, index) => index + 1);
}

function isBlockOffset(offset: number): boolean {
  return offset % BLOCK_SIZE === 0;
}

/**
 * マスの上に重ねる格子。座標はマス1つを1とし、マスと同じ箱に引き伸ばして重ねる。
 * 細い線を先、太い線と外周を後に描き、太い線を上に出す。
 */
export function NonogramGridLines({
  width,
  height,
  revealed,
}: NonogramGridLinesProps) {
  const columnOffsets = listInnerOffsets(width);
  const rowOffsets = listInnerOffsets(height);

  function renderLines(isBlock: boolean) {
    return [
      ...columnOffsets
        .filter((offset) => isBlockOffset(offset) === isBlock)
        .map((offset) => (
          <line
            key={`x${offset}`}
            x1={offset}
            y1={0}
            x2={offset}
            y2={height}
            vectorEffect="non-scaling-stroke"
          />
        )),
      ...rowOffsets
        .filter((offset) => isBlockOffset(offset) === isBlock)
        .map((offset) => (
          <line
            key={`y${offset}`}
            x1={0}
            y1={offset}
            x2={width}
            y2={offset}
            vectorEffect="non-scaling-stroke"
          />
        )),
    ];
  }

  return (
    <svg
      aria-hidden="true"
      data-nonogram-clear-fade=""
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] size-full overflow-visible",
        revealed && "opacity-0",
      )}
    >
      <g className={nonogramToneClassNames.gridLine} strokeWidth={1}>
        {renderLines(false)}
      </g>
      <g
        className={nonogramToneClassNames.blockLine}
        strokeWidth={2}
        fill="none"
      >
        {renderLines(true)}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
