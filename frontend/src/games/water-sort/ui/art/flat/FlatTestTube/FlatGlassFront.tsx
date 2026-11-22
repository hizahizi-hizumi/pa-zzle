import {
  TUBE_INNER,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const slotHeight = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / 4;
const tickTops = [0, 1, 2, 3].map(
  (index) => TUBE_INNER.slotTop + slotHeight * index,
);

/** 管の壁と口の縁の平らな帯、焼き付けた目盛り。壁は液の外に置き、液の色を白で覆わない。 */
export function FlatGlassFront() {
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M3.4 7 V88 A14.6 9.4 0 0 0 32.6 88 V7 H31.1 V88.2 A13.1 7.4 0 0 1 4.9 88.2 V7 Z"
        className="fill-white/80 dark:fill-white/35"
      />
      <g className="fill-white/75 dark:fill-white/40">
        {tickTops.map((y) => (
          <rect key={y} x="22.4" y={y - 0.45} width="5.6" height="0.9" />
        ))}
      </g>
      <rect
        x="1.6"
        y="3.2"
        width="32.8"
        height="4.4"
        rx="1.6"
        className="fill-white/90 dark:fill-white/45"
      />
    </svg>
  );
}
