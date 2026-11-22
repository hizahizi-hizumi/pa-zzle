import {
  CLAMP_HANDLE_TIP_POINTS,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const [[tipBottomX, tipBottomY], [tipTopX, tipTopY]] = CLAMP_HANDLE_TIP_POINTS;
const CLAMP_ARM_PATH = `M31 10.6 L37.6 17.8 L${tipBottomX} ${tipBottomY} L${tipTopX} ${tipTopY} Z`;

type FlatTestTubeClampProps = {
  /** 柄を出す向き。 */
  side: "left" | "right";
};

/** 持っている試験管の首を挟む木の試験管ばさみ。真横から見た、口・柄・ばねの3つの平らな面。 */
export function FlatTestTubeClamp({ side }: FlatTestTubeClampProps) {
  return (
    <svg
      data-test-tube-clamp=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible animate-in fade-in zoom-in-110 duration-150 ease-out motion-reduce:animate-none"
      aria-hidden="true"
    >
      <g
        transform={side === "left" ? "translate(36 0) scale(-1 1)" : undefined}
      >
        <path d={CLAMP_ARM_PATH} className="fill-(--flat-wood-deep)" />
        {/* ばね。柄に巻いた針金を、柄を横切る細い帯で描く。 */}
        <g transform="rotate(-25 41 9.4)" className="fill-(--flat-metal)">
          {[39.3, 40.7, 42.1].map((x) => (
            <rect key={x} x={x} y="5.8" width="0.85" height="7.2" rx="0.4" />
          ))}
        </g>
        <rect
          x="-2.6"
          y="10.2"
          width="40.6"
          height="8.4"
          rx="2"
          className="fill-(--flat-wood)"
        />
      </g>
    </svg>
  );
}
