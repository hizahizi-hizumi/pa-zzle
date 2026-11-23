import {
  CLAMP_HANDLE_TIP_POINTS,
  CLAMP_JAW,
  TUBE_OUTER,
  TUBE_VIEW_BOX,
  TUBE_VIEW_WIDTH,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const [[tipBottomX, tipBottomY], [tipTopX, tipTopY]] = CLAMP_HANDLE_TIP_POINTS;
const jawHeight = CLAMP_JAW.bottom - CLAMP_JAW.top;
// 柄は口の右の端から、右上へ伸ばす。
const CLAMP_ARM_PATH = `M${TUBE_OUTER.right - 1} ${CLAMP_JAW.top + 0.4} L${TUBE_VIEW_WIDTH + 2} ${CLAMP_JAW.bottom - 0.4} L${tipBottomX} ${tipBottomY} L${tipTopX} ${tipTopY} Z`;
const SPRING_CENTER = { x: 42, y: 4.9 } as const;

type TestTubeClampProps = {
  /** 柄を出す向き。 */
  side: "left" | "right";
};

/** 持っている試験管の首を挟む木の試験管ばさみ。真横から見た、口・柄・ばねの3つの平らな面。 */
export function TestTubeClamp({ side }: TestTubeClampProps) {
  return (
    <svg
      data-test-tube-clamp=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible animate-in fade-in zoom-in-110 duration-150 ease-out motion-reduce:animate-none"
      aria-hidden="true"
    >
      <g
        transform={
          side === "left"
            ? `translate(${TUBE_VIEW_WIDTH} 0) scale(-1 1)`
            : undefined
        }
      >
        <path
          d={CLAMP_ARM_PATH}
          className="fill-[#b9874d] dark:fill-[#6e5235]"
        />
        {/* ばね。柄に巻いた針金を、柄を横切る細い帯で描く。 */}
        <g
          transform={`rotate(-28 ${SPRING_CENTER.x} ${SPRING_CENTER.y})`}
          className="fill-[#8e999d] dark:fill-[#6c777c]"
        >
          {[-1.3, 0, 1.3].map((dx) => (
            <rect
              key={dx}
              x={SPRING_CENTER.x + dx - 0.4}
              y={SPRING_CENTER.y - 3}
              width="0.8"
              height="6"
              rx="0.4"
            />
          ))}
        </g>
        <rect
          x="-1.4"
          y={CLAMP_JAW.top}
          width={TUBE_VIEW_WIDTH + 2.8}
          height={jawHeight}
          rx="1.4"
          className="fill-[#d9aa6b] dark:fill-[#94704a]"
        />
      </g>
    </svg>
  );
}
