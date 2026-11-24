import {
  TUBE_BOTTOM_ARC_TOP,
  TUBE_INNER,
  TUBE_OUTER,
  TUBE_RIM,
  TUBE_SLOT_HEIGHT,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const outerRadiusY = TUBE_OUTER.bottom - TUBE_BOTTOM_ARC_TOP;
const innerRadiusY = TUBE_INNER.bottomDepth;
// 管の壁。外側を下って底を回り、内側を上って戻る、液の外にある帯。
const WALL_PATH =
  `M${TUBE_OUTER.left} ${TUBE_RIM.bottom} V${TUBE_BOTTOM_ARC_TOP} ` +
  `A${(TUBE_OUTER.right - TUBE_OUTER.left) / 2} ${outerRadiusY} 0 0 0 ${TUBE_OUTER.right} ${TUBE_BOTTOM_ARC_TOP} ` +
  `V${TUBE_RIM.bottom} H${TUBE_INNER.right} V${TUBE_BOTTOM_ARC_TOP} ` +
  `A${(TUBE_INNER.right - TUBE_INNER.left) / 2} ${innerRadiusY} 0 0 1 ${TUBE_INNER.left} ${TUBE_BOTTOM_ARC_TOP} ` +
  `V${TUBE_RIM.bottom} Z`;

const tickTops = [0, 1, 2, 3].map(
  (index) => TUBE_INNER.slotTop + TUBE_SLOT_HEIGHT * index,
);

/**
 * 管の壁と口の縁の平らな帯、焼き付けた目盛り。壁は液の外に置き、液の色を覆わない。
 * 壁の色は、どの液の色の横でも輪郭が消えないよう、いちばん近い薄い灰とも明るさで離す（CIELAB の明るさの差 11）。
 */
export function GlassFront() {
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path d={WALL_PATH} className="fill-[#94a9b4] dark:fill-[#5b6f77]" />
      <g className="fill-white/80 dark:fill-white/40">
        {tickTops.map((y) => (
          <rect
            key={y}
            x={TUBE_INNER.right - 6}
            y={y - 0.4}
            width="5"
            height="0.8"
          />
        ))}
      </g>
      <rect
        x={TUBE_RIM.left}
        y={TUBE_RIM.top}
        width={TUBE_RIM.right - TUBE_RIM.left}
        height={TUBE_RIM.bottom - TUBE_RIM.top}
        rx="1.4"
        className="fill-[#94a9b4] dark:fill-[#5b6f77]"
      />
    </svg>
  );
}
