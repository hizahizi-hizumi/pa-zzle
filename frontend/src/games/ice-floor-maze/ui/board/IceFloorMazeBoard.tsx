import { useEffect, useLayoutEffect, useRef } from "react";

import type { IceFloorMazeOperation } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard as IceFloorMazeBoardState } from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";
import {
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  prefersReducedMotion,
  type RejectionShakeTiming,
  waitForAnimations,
} from "@/lib/motion";

type IceFloorMazeBoardProps = {
  board: IceFloorMazeBoardState;
  goal: number;
  /** 駒のいるマス。 */
  position: number;
  /** 直前の滑り。跡を描き、滑りや押し戻しを動かす。 */
  operation: IceFloorMazeOperation | null;
  /** ゴールで止まってから完成演出を終えるまでの間だけ `true`。 */
  clearing: boolean;
  /** 駒が滑って見えている間だけ `true` を知らせる。 */
  onSlideAnimationActivityChange: (active: boolean) => void;
  onClearAnimationComplete: () => void;
};

/**
 * 滑りは距離に比例する時間で、等速で動かす。長い滑りでも途中のマスが描かれ、ゴールの通過が動きから読める。
 * 上限は12×14の盤面の最も長い滑り（13マス）が収まる長さに近く、それより長い滑りでもこれを超えない。
 */
const SLIDE_BASE_MS = 45;
const SLIDE_PER_CELL_MS = 32;
const SLIDE_MAX_MS = 400;

/** 成立しない向きへの押し戻しは、マスの大きさによらず画面上でこの距離だけ押す。 */
const BLOCKED_PUSH_PX = 6;
const blockedShakeTiming: RejectionShakeTiming = {
  durationMs: 200,
  easing: "ease-out",
};

const CLEAR_BURST_DURATION_MS = 560;
const CLEAR_POP_DURATION_MS = 360;
const CLEAR_HOLD_MS = 280;
/** 動きを減らす設定では、駒がゴールに止まった姿を少し見せてから完成演出を終える。 */
const CLEAR_REDUCED_MOTION_HOLD_MS = 400;

const clearBurstKeyframes: Keyframe[] = [
  { transform: "scale(1)", opacity: 0.9 },
  { transform: "scale(2.2)", opacity: 0 },
];

const clearPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.18)", offset: 0.4 },
  { transform: "scale(1)" },
];

function getIceFloorMazeSlideDurationMs(distance: number): number {
  return Math.min(SLIDE_MAX_MS, SLIDE_BASE_MS + SLIDE_PER_CELL_MS * distance);
}

/** 盤面の外壁・岩・氷・ゴール・駒と直前の滑りの跡を描き、滑り・押し戻し・完成演出を動かす。入力は受けない。 */
export function IceFloorMazeBoard({
  board,
  goal,
  position,
  operation,
  clearing,
  onSlideAnimationActivityChange,
  onClearAnimationComplete,
}: IceFloorMazeBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pieceSlideRef = useRef<SVGGElement>(null);
  const piecePushRef = useRef<SVGGElement>(null);
  const piecePopRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGRectElement>(null);
  const goalBurstRef = useRef<SVGCircleElement>(null);
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const aspectRatio = viewBox.width / viewBox.height;
  const piece = getIceFloorMazeCellCenter(board, position);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);
  const slid = operation?.type === "slid" ? operation : null;

  // 次の入力が来たら、表示中の滑りを止めて駒を終点（次の滑りの始点）へ飛ばしてから次の滑りを始める。
  useLayoutEffect(() => {
    if (operation?.type !== "slid" || prefersReducedMotion()) {
      return;
    }

    const animations = animateSlide(
      pieceSlideRef.current,
      trailRef.current,
      operation,
      board,
    );
    if (animations.length === 0) {
      return;
    }

    onSlideAnimationActivityChange(true);
    const stopWaiting = waitForAnimations(animations, () =>
      onSlideAnimationActivityChange(false),
    );
    return () => {
      stopWaiting();
      for (const animation of animations) {
        animation.cancel();
      }
      onSlideAnimationActivityChange(false);
    };
  }, [board, onSlideAnimationActivityChange, operation]);

  useLayoutEffect(() => {
    if (operation?.type !== "blocked") {
      return;
    }

    const vector = iceFloorMazeDirectionVectors[operation.direction];
    const unitsPerPixel = measureUnitsPerPixel(svgRef.current, viewBox.width);
    const push = BLOCKED_PUSH_PX * unitsPerPixel;
    playRejectionShake(
      piecePushRef.current,
      [
        { transform: "translate(0px, 0px)" },
        {
          transform: `translate(${vector.x * push}px, ${vector.y * push}px)`,
          offset: 0.35,
        },
        {
          transform: `translate(${-vector.x * push * 0.25}px, ${-vector.y * push * 0.25}px)`,
          offset: 0.7,
        },
        { transform: "translate(0px, 0px)" },
      ],
      blockedShakeTiming,
    );
  }, [operation, viewBox.width]);

  const clearingSlideDistance =
    slid?.isClearingMove === true ? slid.path.length : 0;
  useEffect(() => {
    if (!clearing) {
      return;
    }

    const delay =
      clearingSlideDistance > 0
        ? getIceFloorMazeSlideDurationMs(clearingSlideDistance)
        : 0;
    return playAnimations({
      animate: () =>
        [
          goalBurstRef.current?.animate?.(clearBurstKeyframes, {
            duration: CLEAR_BURST_DURATION_MS,
            delay,
            easing: MOTION_EASING.celebrate,
          }),
          piecePopRef.current?.animate?.(clearPopKeyframes, {
            duration: CLEAR_POP_DURATION_MS,
            delay,
            easing: MOTION_EASING.celebrate,
          }),
        ].filter((animation) => animation !== undefined),
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: CLEAR_REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: 0,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, clearingSlideDistance, onClearAnimationComplete]);

  return (
    <div className="flex size-full items-center justify-center [container-type:size]">
      <svg
        ref={svgRef}
        role="img"
        aria-label="盤面"
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="block max-h-full max-w-full overflow-visible"
        style={{
          aspectRatio,
          // PC の広い画面でも盤面を読みやすい大きさに留める。
          width: `min(100cqw, min(100cqh, 44rem) * ${aspectRatio})`,
        }}
      >
        <IceFloorMazeTerrain board={board} goal={goal} />
        {slid ? (
          <IceFloorMazeTrail
            key={slid.id}
            ref={trailRef}
            board={board}
            direction={slid.direction}
            from={slid.from}
            to={slid.to}
          />
        ) : null}
        <g transform={`translate(${goalCenter.x} ${goalCenter.y})`}>
          <IceFloorMazeGoalMark burstRef={goalBurstRef} />
        </g>
        <g
          data-piece-cell={position}
          transform={`translate(${piece.x} ${piece.y})`}
        >
          <g ref={pieceSlideRef}>
            <g ref={piecePushRef}>
              <g
                ref={piecePopRef}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <IceFloorMazePieceMark />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * 駒を始点から終点まで等速で動かし、跡を同じ速さで伸ばす。
 * 駒は終点に描いてあるので、始点までの差から 0 へ戻す。SVG の要素では CSS の px は盤面の座標の単位（マス）になる。
 */
function animateSlide(
  piece: SVGGElement | null,
  trail: SVGRectElement | null,
  operation: Extract<IceFloorMazeOperation, { type: "slid" }>,
  board: IceFloorMazeBoardState,
): Animation[] {
  const from = getIceFloorMazeCellCenter(board, operation.from);
  const to = getIceFloorMazeCellCenter(board, operation.to);
  const timing: KeyframeAnimationOptions = {
    duration: getIceFloorMazeSlideDurationMs(operation.path.length),
    easing: "linear",
  };
  const scaleAxis = from.y === to.y ? "scaleX" : "scaleY";

  return [
    piece?.animate?.(
      [
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      timing,
    ),
    trail?.animate?.(
      [{ transform: `${scaleAxis}(0)` }, { transform: `${scaleAxis}(1)` }],
      timing,
    ),
  ].filter((animation) => animation !== undefined);
}

/** 画面上の1px が盤面の座標で何マスにあたるか。大きさを測れない環境では 0 を返し、押し戻さない。 */
function measureUnitsPerPixel(
  svg: SVGSVGElement | null,
  viewBoxWidth: number,
): number {
  const width = svg?.getBoundingClientRect().width ?? 0;
  return width > 0 ? viewBoxWidth / width : 0;
}

export const _private = { getIceFloorMazeSlideDurationMs };
