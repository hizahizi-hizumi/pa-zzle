import { type Ref, useId } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeCellCenter } from "@/games/ice-floor-maze/ui/board/board-geometry";
import { iceFloorMazeGoalRing } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard/IceFloorMazeGoalBurst";
import {
  createIceFloorMazeDrawnCellPath,
  createIceFloorMazeEnclosedOutsidePath,
  listIceFloorMazeEnclosedOutsideCells,
} from "@/games/ice-floor-maze/ui/board/terrain-paths";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";
import { MOTION_EASING } from "@/lib/motion";

type IceFloorMazeClearEffectsProps = {
  ref: Ref<SVGGElement>;
  board: IceFloorMazeBoard;
  goal: number;
};

/** 完成の音（約0.5秒）の鳴っている間に、輪ときらめきと光の帯が出きるようにする。 */
const RING_DURATION_MS = 460;
const RING_STAGGER_MS = 80;
const RING_COUNT = 3;
/** ゴールから氷の面へ広がる、白い明かり。輪より先に面で広がり、止まった所の氷が光ったと読ませる。色を重ねて岩や氷を濁らせない。 */
const GLOW_RADIUS = 0.5;
const GLOW_SPREAD = 5;
const GLOW_DURATION_MS = 480;
const GLOW_OPACITY = 0.55;
const SPARKLE_DURATION_MS = 440;
const SPARKLE_DELAY_MS = 60;
const SPARKLE_COUNT = 8;
const SPARKLE_REACH = 1.15;
const SWEEP_DURATION_MS = 520;
const SWEEP_DELAY_MS = 60;
/** 光の帯が氷の面を渡りきって外へ抜けるまでの、余分な距離。 */
const SWEEP_OVERRUN = 2;
/** 光の帯は、岩場の上を渡っても岩が白く褪せて見えない薄さにする。 */
const SWEEP_OPACITY = 0.3;

/** 4つの先のとがった、小さなきらめき。 */
const sparklePath =
  "M0 -0.1Q0.015 -0.015 0.1 0Q0.015 0.015 0 0.1Q-0.015 0.015 -0.1 0Q-0.015 -0.015 0 -0.1Z";

/**
 * 完成演出。ゴールの印から明かりが氷の下へ広がり、輪が3つ続けて広がり、きらめきが八方へ散り、氷の面を光の帯が1度だけ渡る。どれも氷の面の中に留める。
 * 解く間は抑えていた光を、止まった瞬間に盤面全体へ解放する。どれもふだんは見せない。
 */
export function IceFloorMazeClearEffects({
  ref,
  board,
  goal,
}: IceFloorMazeClearEffectsProps) {
  const clipId = `ifm${useId().replace(/[^a-zA-Z0-9]/g, "")}-clear-clip`;
  const center = getIceFloorMazeCellCenter(board, goal);
  const span = board.width + board.height;

  return (
    <g ref={ref} pointerEvents="none">
      <defs>
        <clipPath id={clipId}>
          {/* 盤面に囲まれた盤面の外も岩場として地に含めるので、光も同じ範囲を渡す。 */}
          <path
            d={
              createIceFloorMazeDrawnCellPath(board) +
              createIceFloorMazeEnclosedOutsidePath(
                board,
                listIceFloorMazeEnclosedOutsideCells(board),
              )
            }
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <line
          data-clear-sweep=""
          x1={0}
          y1={-1}
          x2={-board.height - 2}
          y2={board.height + 1}
          stroke={iceFloorMazeTone.iceSheen}
          strokeOpacity={SWEEP_OPACITY}
          strokeWidth={span * 0.09}
          opacity={0}
        />
        <g transform={`translate(${center.x} ${center.y})`}>
          <circle
            data-clear-glow=""
            r={GLOW_RADIUS}
            fill={iceFloorMazeTone.goalGlow}
            opacity={0}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: 並びの変わらない同じ輪を数だけ描く。
              key={index}
              data-clear-ring=""
              r={iceFloorMazeGoalRing.radius}
              fill="none"
              stroke={iceFloorMazeTone.goal}
              strokeWidth={iceFloorMazeGoalRing.width}
              opacity={0}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
          {Array.from({ length: SPARKLE_COUNT }, (_, index) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: 並びの変わらない同じきらめきを数だけ描く。
              key={index}
              data-clear-sparkle=""
              d={sparklePath}
              fill={iceFloorMazeTone.goalSparkle}
              opacity={0}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
        </g>
      </g>
    </g>
  );
}

/** 完成演出を `delayMs` 後に始める。 */
export function animateIceFloorMazeClear(
  group: SVGGElement | null,
  delayMs: number,
  board: Pick<IceFloorMazeBoard, "width" | "height">,
): Animation[] {
  if (!group) {
    return [];
  }

  const rings = Array.from(
    group.querySelectorAll<SVGCircleElement>("[data-clear-ring]"),
    (ring, index) =>
      ring.animate?.(
        [
          { transform: "scale(1)", opacity: 0.9 },
          { transform: `scale(${2.4 + index * 0.9})`, opacity: 0 },
        ],
        {
          duration: RING_DURATION_MS,
          delay: delayMs + RING_STAGGER_MS * index,
          easing: MOTION_EASING.celebrate,
        },
      ),
  );
  const sparkles = Array.from(
    group.querySelectorAll<SVGPathElement>("[data-clear-sparkle]"),
    (sparkle, index) => {
      const angle = (Math.PI * 2 * (index + 0.5)) / SPARKLE_COUNT;
      const reach = SPARKLE_REACH * (index % 2 === 0 ? 1 : 0.72);
      const x = Math.cos(angle) * reach;
      const y = Math.sin(angle) * reach;
      return sparkle.animate?.(
        [
          {
            transform: `translate(${x * 0.3}px, ${y * 0.3}px) scale(0.4)`,
            opacity: 0,
          },
          {
            transform: `translate(${x * 0.75}px, ${y * 0.75}px) scale(1.5)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0 },
        ],
        {
          duration: SPARKLE_DURATION_MS,
          delay: delayMs + SPARKLE_DELAY_MS,
          easing: MOTION_EASING.enter,
        },
      );
    },
  );
  const sweepLine = group.querySelector<SVGLineElement>("[data-clear-sweep]");
  const sweep = sweepLine?.animate?.(
    [
      { transform: "translateX(-2px)", opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 },
      {
        transform: `translateX(${board.width + board.height + SWEEP_OVERRUN}px)`,
        opacity: 0,
      },
    ],
    {
      duration: SWEEP_DURATION_MS,
      delay: delayMs + SWEEP_DELAY_MS,
      easing: MOTION_EASING.standard,
    },
  );

  const glow = group
    .querySelector<SVGCircleElement>("[data-clear-glow]")
    ?.animate?.(
      [
        { transform: "scale(1)", opacity: GLOW_OPACITY },
        { transform: `scale(${GLOW_SPREAD})`, opacity: 0 },
      ],
      {
        duration: GLOW_DURATION_MS,
        delay: delayMs,
        easing: MOTION_EASING.celebrate,
      },
    );

  return [glow, ...rings, ...sparkles, sweep].filter(
    (animation) => animation !== undefined,
  );
}
