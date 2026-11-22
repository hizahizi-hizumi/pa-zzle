import { flatSceneColorClassName } from "@/games/water-sort/ui/art/flat/flat-scene-colors";
import { WATER_SORT_RACK_OVERHANG_RATIO } from "@/games/water-sort/ui/board/rack-extent";
import type { TestTubeRackSceneProps } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/TestTubeRackScene";
import { cn } from "@/lib/utils";

/** 試験管の箱の下の端から、ガラスの底の外側までの高さ（試験管の高さに対する割合）。 */
const TUBE_GLASS_BOTTOM_GAP_RATIO = 0.028;

/**
 * 真横から見た試験管立てと、それを置く実験台・流しの戸棚。
 * 実験台は天板の前の縁だけ、試験管立ては首の後ろの横板・底を受ける横板・両端の側板だけを平らな面で描く。
 */
export function FlatRackScene({ layout }: TestTubeRackSceneProps) {
  const { tubeWidth: w, tubeHeight: h, rows } = layout;
  const lastRow = rows[rows.length - 1];
  const firstRow = rows[0];
  if (!lastRow || !firstRow) {
    return null;
  }

  const rackLeft = layout.left - w * WATER_SORT_RACK_OVERHANG_RATIO;
  const rackRight = layout.right + w * WATER_SORT_RACK_OVERHANG_RATIO;
  const postWidth = Math.max(6, w * 0.2);
  const railHeight = h * 0.07;
  const baseHeight = h * 0.07;
  function getBaseTop(rowBottom: number): number {
    return rowBottom - h * TUBE_GLASS_BOTTOM_GAP_RATIO;
  }
  const contactY = getBaseTop(lastRow.bottom) + baseHeight;
  const postTop = firstRow.top + h * 0.1;
  const postRadius = Math.min(4, postWidth / 2);
  const counterHeight = Math.max(12, h * 0.11);
  const cabinetTop = contactY + counterHeight;
  const sceneLeft = -layout.width;
  const sceneWidth = layout.width * 3;
  const doorCount = layout.width > 640 ? 5 : 3;
  const doorWidth = layout.width / doorCount;
  const seamWidth = 3;

  return (
    <svg
      width={layout.width}
      height={layout.height}
      className={cn(
        "absolute top-0 left-0 overflow-visible",
        flatSceneColorClassName,
      )}
      aria-hidden="true"
    >
      {/* 流しの戸棚。戸は壁と同じ色で、戸の間の隙間と取っ手だけを置く。 */}
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={3000}
        className="fill-(--flat-wall)"
      />
      {Array.from({ length: doorCount + 1 }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 戸の隙間は並びの位置だけで決まる。
          key={index}
          x={index * doorWidth - seamWidth / 2}
          y={cabinetTop}
          width={seamWidth}
          height={3000}
          className="fill-(--flat-seam)"
        />
      ))}
      {Array.from({ length: doorCount }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 取っ手は戸の並びの位置だけで決まる。
          key={index}
          x={(index + 0.5) * doorWidth - 16}
          y={cabinetTop + 12}
          width={32}
          height={5}
          rx={2.5}
          className="fill-(--flat-handle)"
        />
      ))}
      {/* 実験台の天板の前の縁 */}
      <rect
        x={sceneLeft}
        y={contactY}
        width={sceneWidth}
        height={counterHeight}
        className="fill-(--flat-bench)"
      />
      {/* 試験管立ての側板 */}
      {[rackLeft, rackRight - postWidth].map((x) => (
        <path
          key={x}
          d={`M${x} ${contactY} V${postTop + postRadius} Q${x} ${postTop} ${x + postRadius} ${postTop} H${x + postWidth - postRadius} Q${x + postWidth} ${postTop} ${x + postWidth} ${postTop + postRadius} V${contactY} Z`}
          className="fill-(--flat-wood-deep)"
        />
      ))}
      {rows.map((row) => (
        <g key={row.top} className="fill-(--flat-wood)">
          {/* 首の後ろを通る横板 */}
          <rect
            x={rackLeft + postWidth}
            y={row.top + h * 0.15}
            width={rackRight - rackLeft - postWidth * 2}
            height={railHeight}
          />
          {/* 試験管の底を受ける横板 */}
          <rect
            x={rackLeft + postWidth}
            y={getBaseTop(row.bottom)}
            width={rackRight - rackLeft - postWidth * 2}
            height={baseHeight}
          />
        </g>
      ))}
    </svg>
  );
}
