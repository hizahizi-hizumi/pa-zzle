import { WATER_SORT_RACK_OVERHANG_RATIO } from "@/games/water-sort/ui/board/rack-extent";
import { TUBE_OUTER } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import { LabWindow } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/RackScene/LabWindow";
import type { RackLayout } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";
import { labSceneColorClassName } from "@/games/water-sort/ui/lab-scene-colors";
import { cn } from "@/lib/utils";

type RackSceneProps = {
  layout: RackLayout;
};

/** 試験管の底が底板に沈む深さと、底板の厚さ（試験管の高さに対する割合）。 */
const BASE_SINK_RATIO = 0.03;
const BASE_THICKNESS_RATIO = 0.05;
const MIN_BASE_THICKNESS_PX = 4;
/** 首の後ろを通る横板の上の端と厚さ（試験管の高さに対する割合）。 */
const RAIL_TOP_RATIO = 0.17;
const RAIL_THICKNESS_RATIO = 0.045;
/** 側板の上の端（上の段の試験管の上の端からの、試験管の高さに対する割合）。 */
const POST_TOP_RATIO = 0.12;
/** 実験台の天板の縁の厚さ。 */
const BENCH_EDGE_RATIO = 0.08;
const MIN_BENCH_EDGE_PX = 10;
/** 窓を置く壁の上の端の、上の見出しの文字とボタンからの間（注ぐ動きが見出しとの間に残す間と同じ）。 */
const WINDOW_GAP_ABOVE_PX = 4;
/** 窓台の下の端を、上の段の試験管の上の端からどれだけ上に置くか（試験管の高さに対する割合）。 */
const WINDOW_GAP_RATIO = 0.1;
/** 流しの戸棚の戸の間の隙間と、取っ手の大きさ。 */
const DOOR_SEAM_PX = 3;
const HANDLE_WIDTH_PX = 32;
const HANDLE_HEIGHT_PX = 5;
/** 盤面の外の左右と下へ、画面の端を越えて描く広さ（入れ物の大きさに対する倍数）。 */
const SCENE_SPREAD = 3;

/**
 * 真横から見た理科室の窓・試験管立て・実験台・流しの戸棚。どれも一定の太さの平らな面だけで描く。
 * 窓は上の見出しの文字とボタンより下、上の段の試験管より上の壁に、試験管立ての側板は両端の試験管の外へ張り出す幅の中に、実験台と戸棚は下の段の試験管より下に置き、
 * 試験管の後ろには、試験管立ての木の板のほかに何も置かない。
 */
export function RackScene({ layout }: RackSceneProps) {
  const { tubeWidth: w, tubeHeight: h, rows } = layout;
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  if (!firstRow || !lastRow) {
    return null;
  }

  const overhang = w * WATER_SORT_RACK_OVERHANG_RATIO;
  const rackLeft = layout.left - overhang;
  const rackRight = layout.right + overhang;
  const innerWidth = rackRight - rackLeft - overhang * 2;
  const baseThickness = Math.max(
    MIN_BASE_THICKNESS_PX,
    h * BASE_THICKNESS_RATIO,
  );
  function getBaseTop(rowTop: number): number {
    return rowTop + h * (TUBE_OUTER.bottom / 100 - BASE_SINK_RATIO);
  }
  const benchTop = getBaseTop(lastRow.top) + baseThickness;
  const benchEdge = Math.max(MIN_BENCH_EDGE_PX, h * BENCH_EDGE_RATIO);
  const cabinetTop = benchTop + benchEdge;
  const postTop = firstRow.top + h * POST_TOP_RATIO;
  const postRadius = Math.min(overhang / 2, 4);
  const sceneLeft = -layout.width * (SCENE_SPREAD - 1) * 0.5;
  const sceneWidth = layout.width * SCENE_SPREAD;
  const sceneHeight = layout.height * SCENE_SPREAD;
  const doorCount = layout.width > 640 ? 5 : 3;
  const doorWidth = layout.width / doorCount;

  return (
    <svg
      width={layout.width}
      height={layout.height}
      className={cn(
        "absolute top-0 left-0 overflow-visible",
        labSceneColorClassName,
      )}
      aria-hidden="true"
    >
      <LabWindow
        top={layout.headingBottom + WINDOW_GAP_ABOVE_PX}
        bottom={firstRow.top - h * WINDOW_GAP_RATIO}
        centerX={layout.width / 2}
        maxWidth={layout.width}
      />
      {/* 流しの戸棚。戸は壁と同じ色で、戸の間の隙間と取っ手だけを置く。 */}
      {Array.from({ length: doorCount + 1 }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 戸の隙間は並びの位置だけで決まる。
          key={index}
          x={index * doorWidth - DOOR_SEAM_PX / 2}
          y={cabinetTop}
          width={DOOR_SEAM_PX}
          height={sceneHeight}
          className="fill-(--lab-seam)"
        />
      ))}
      {Array.from({ length: doorCount }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 取っ手は戸の並びの位置だけで決まる。
          key={index}
          x={(index + 0.5) * doorWidth - HANDLE_WIDTH_PX / 2}
          y={cabinetTop + 12}
          width={HANDLE_WIDTH_PX}
          height={HANDLE_HEIGHT_PX}
          rx={HANDLE_HEIGHT_PX / 2}
          className="fill-(--lab-handle)"
        />
      ))}
      {/* 試験管立ての側板。下の端は実験台の縁の後ろに隠す。 */}
      {[rackLeft, rackRight - overhang].map((x) => (
        <rect
          key={x}
          x={x}
          y={postTop}
          width={overhang}
          height={cabinetTop - postTop}
          rx={postRadius}
          className="fill-(--lab-wood-deep)"
        />
      ))}
      {/* 実験台の天板の前の縁 */}
      <rect
        x={sceneLeft}
        y={benchTop}
        width={sceneWidth}
        height={benchEdge}
        className="fill-(--lab-bench)"
      />
      {rows.map((row) => (
        <g key={row.top} className="fill-(--lab-wood)">
          {/* 首の後ろを通る横板。試験管のガラスは透けないので、試験管の間にだけ見える。 */}
          <rect
            x={rackLeft + overhang}
            y={row.top + h * RAIL_TOP_RATIO}
            width={innerWidth}
            height={h * RAIL_THICKNESS_RATIO}
          />
          {/* 試験管の底を受ける底板 */}
          <rect
            x={rackLeft + overhang}
            y={getBaseTop(row.top)}
            width={innerWidth}
            height={baseThickness}
          />
        </g>
      ))}
    </svg>
  );
}
