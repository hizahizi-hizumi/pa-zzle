import { useEffect, useLayoutEffect, useRef } from "react";

import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard as IceFloorMazeBoardState } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeCellChanges } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard/IceFloorMazeCellChanges";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";
import {
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
} from "@/games/ice-floor-maze/ui/board/slide-timing";
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
  /** 今の盤面のマス。 */
  cells: readonly IceFloorMazeStateCell[];
  goal: number;
  /** 駒のいるマス。 */
  position: number;
  /** 直前の成立した滑り。跡を描き、滑りを動かす。 */
  lastSlide: IceFloorMazeLastSlide | null;
  /** 直前の成立しなかった入力。押し戻しと、阻んだもろい岩の揺れを動かす。跡には関わらない。 */
  blockedInput: IceFloorMazeBlockedInput | null;
  /** ゴールで止まってから完成演出を終えるまでの間だけ `true`。 */
  clearing: boolean;
  /** 駒が滑って見えている間だけ `true` を知らせる。 */
  onSlideAnimationActivityChange: (active: boolean) => void;
  onClearAnimationComplete: () => void;
};

/**
 * 成立しない向きへの押し戻し。駒が止め役へ2度ぶつかって跳ね返り、動けなかったとはっきり分かる量と長さにする。
 * 押す距離はマスの割合で決め、マスの小さい狭い画面でも画面上で `BLOCKED_PUSH_MIN_PX` より小さくしない。
 */
const BLOCKED_PUSH_CELLS = 0.26;
const BLOCKED_PUSH_MIN_PX = 8;
const blockedShakeTiming: RejectionShakeTiming = {
  durationMs: 340,
  easing: "ease-out",
};
/** 押す距離に掛ける、ぶつかる向きへの動きの割合と、その時刻。負の値は跳ね返り。 */
const blockedPushSteps = [
  { ratio: 1, offset: 0.18 },
  { ratio: -0.3, offset: 0.38 },
  { ratio: 0.5, offset: 0.58 },
  { ratio: -0.12, offset: 0.8 },
] as const;

/**
 * 隣のもろい岩へ押したときは、押された岩が小さく揺れて持ちこたえる。崩れるのは離れたところから滑ってきて
 * ぶつかったときだけで、隣から押しても崩れないことを返す。駒の押し戻しが岩に届く時刻から揺らす。
 */
const BRITTLE_ROCK_HOLD_DEGREES = 8;
const BRITTLE_ROCK_HOLD_PUSH = 0.08;
const brittleRockHoldTiming: RejectionShakeTiming = {
  durationMs: 320,
  easing: "ease-out",
};

/** 駒が止め役にぶつかって止まった瞬間、進んだ向きに少しつぶれて戻る。 */
const IMPACT_DURATION_MS = 160;
const IMPACT_SQUASH = 0.8;
const IMPACT_STRETCH = 1.1;

/** ゴールの上を止まらずに通り過ぎた瞬間、ゴールの輪が小さく一度だけ広がる。クリアの輪より小さく短い。 */
const GOAL_PASS_DURATION_MS = 280;
const goalPassKeyframes: Keyframe[] = [
  { transform: "scale(1)", opacity: 0.7 },
  { transform: "scale(1.5)", opacity: 0 },
];

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

/**
 * 盤面の外壁・氷・岩・もろい岩・崩れた跡・薄い氷・水面・ゴール・駒と直前の滑りの跡を描き、滑り・ぶつかって止まる反応・
 * ゴールの通過・崩れる・割れる・押し戻し・完成演出を動かす。入力は受けない。
 */
export function IceFloorMazeBoard({
  board,
  cells,
  goal,
  position,
  lastSlide,
  blockedInput,
  clearing,
  onSlideAnimationActivityChange,
  onClearAnimationComplete,
}: IceFloorMazeBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pieceSlideRef = useRef<SVGGElement>(null);
  const piecePushRef = useRef<SVGGElement>(null);
  const pieceImpactRef = useRef<SVGGElement>(null);
  const piecePopRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGRectElement>(null);
  const goalBurstRef = useRef<SVGCircleElement>(null);
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const aspectRatio = viewBox.width / viewBox.height;
  const piece = getIceFloorMazeCellCenter(board, position);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);

  // 次の滑りが来たら、表示中の滑りを止めて駒を終点（次の滑りの始点）へ飛ばしてから次の滑りを始める。
  // 成立しない向きの入力では止めず、押し戻しを重ねる。
  useLayoutEffect(() => {
    if (!lastSlide || prefersReducedMotion()) {
      return;
    }

    const animations = animateSlide(
      pieceSlideRef.current,
      trailRef.current,
      lastSlide,
      board,
    );
    if (animations.length === 0) {
      return;
    }

    const reactions = animateSlideReactions(
      pieceImpactRef.current,
      goalBurstRef.current,
      lastSlide,
      goal,
    );
    onSlideAnimationActivityChange(true);
    const stopWaiting = waitForAnimations(animations, () =>
      onSlideAnimationActivityChange(false),
    );
    return () => {
      stopWaiting();
      for (const animation of [...animations, ...reactions]) {
        animation.cancel();
      }
      onSlideAnimationActivityChange(false);
    };
  }, [board, goal, lastSlide, onSlideAnimationActivityChange]);

  // 盤面のマスが変わるのは滑り・待った・盤面を戻すのときで、そのとき成立しなかった入力は消えているので、揺らし直さない。
  useLayoutEffect(() => {
    if (!blockedInput) {
      return;
    }

    const vector = iceFloorMazeDirectionVectors[blockedInput.direction];
    const unitsPerPixel = measureUnitsPerPixel(svgRef.current, viewBox.width);
    const push =
      unitsPerPixel > 0
        ? Math.max(BLOCKED_PUSH_CELLS, BLOCKED_PUSH_MIN_PX * unitsPerPixel)
        : 0;
    playRejectionShake(
      piecePushRef.current,
      [
        { transform: "translate(0px, 0px)" },
        ...blockedPushSteps.map(({ ratio, offset }) => ({
          transform: `translate(${vector.x * push * ratio}px, ${vector.y * push * ratio}px)`,
          offset,
        })),
        { transform: "translate(0px, 0px)" },
      ],
      blockedShakeTiming,
    );

    const { stopper } = blockedInput;
    if (stopper !== null && cells[stopper] === "brittle-rock") {
      playRejectionShake(
        svgRef.current?.querySelector(
          `[data-brittle-rock-cell="${stopper}"] > [data-cell-body]`,
        ),
        createBrittleRockHoldKeyframes(vector),
        brittleRockHoldTiming,
      );
    }
  }, [blockedInput, cells, viewBox.width]);

  const clearingSlideDistance =
    lastSlide?.isClearingMove === true ? lastSlide.path.length : 0;
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
        <IceFloorMazeTerrain
          board={board}
          cells={cells}
          goal={goal}
          beneathCellFaces={
            lastSlide ? (
              <IceFloorMazeTrail
                key={lastSlide.id}
                ref={trailRef}
                board={board}
                direction={lastSlide.direction}
                from={lastSlide.from}
                to={lastSlide.to}
              />
            ) : null
          }
        />
        {lastSlide ? (
          <IceFloorMazeCellChanges
            key={`cell-changes-${lastSlide.id}`}
            board={board}
            slide={lastSlide}
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
                ref={pieceImpactRef}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <g
                  ref={piecePopRef}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                >
                  <IceFloorMazePieceMark />
                </g>
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
  slide: IceFloorMazeLastSlide,
  board: IceFloorMazeBoardState,
): Animation[] {
  const from = getIceFloorMazeCellCenter(board, slide.from);
  const to = getIceFloorMazeCellCenter(board, slide.to);
  const timing: KeyframeAnimationOptions = {
    duration: getIceFloorMazeSlideDurationMs(slide.path.length),
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

/**
 * 滑りに合わせた反応。止め役にぶつかって止まった時刻に駒が進んだ向きへつぶれ、ゴールを通り過ぎた時刻にゴールの輪が小さく広がる。
 * ゴールで止まった滑りは完成演出が駒をふくらませるので、つぶさない。
 */
function animateSlideReactions(
  piece: SVGGElement | null,
  goalBurst: SVGCircleElement | null,
  slide: IceFloorMazeLastSlide,
  goal: number,
): Animation[] {
  const distance = slide.path.length;
  const horizontal = slide.direction === "left" || slide.direction === "right";
  const squash = horizontal
    ? `scale(${IMPACT_SQUASH}, ${IMPACT_STRETCH})`
    : `scale(${IMPACT_STRETCH}, ${IMPACT_SQUASH})`;

  return [
    slide.isClearingMove
      ? undefined
      : piece?.animate?.(
          [
            { transform: "scale(1, 1)" },
            { transform: squash, offset: 0.35 },
            { transform: "scale(1, 1)" },
          ],
          {
            duration: IMPACT_DURATION_MS,
            delay: getIceFloorMazeSlideDurationMs(distance),
            easing: MOTION_EASING.standard,
          },
        ),
    slide.passedGoal
      ? goalBurst?.animate?.(goalPassKeyframes, {
          duration: GOAL_PASS_DURATION_MS,
          delay: getIceFloorMazeSlideProgressMs(
            distance,
            slide.path.indexOf(goal) + 1,
          ),
          easing: MOTION_EASING.exit,
        })
      : undefined,
  ].filter((animation) => animation !== undefined);
}

/** 押された向きへ少し傾いて揺れ戻る。駒の押し戻しが届くまでは動かさない。 */
function createBrittleRockHoldKeyframes(vector: {
  x: number;
  y: number;
}): Keyframe[] {
  const tilt = (vector.x === 0 ? 1 : vector.x) * BRITTLE_ROCK_HOLD_DEGREES;
  const pushX = vector.x * BRITTLE_ROCK_HOLD_PUSH;
  const pushY = vector.y * BRITTLE_ROCK_HOLD_PUSH;
  return [
    { transform: "translate(0px, 0px) rotate(0deg)" },
    { transform: "translate(0px, 0px) rotate(0deg)", offset: 0.15 },
    {
      transform: `translate(${pushX}px, ${pushY}px) rotate(${tilt}deg)`,
      offset: 0.35,
    },
    {
      transform: `translate(0px, 0px) rotate(${-tilt * 0.6}deg)`,
      offset: 0.6,
    },
    { transform: `translate(0px, 0px) rotate(${tilt * 0.3}deg)`, offset: 0.8 },
    { transform: "translate(0px, 0px) rotate(0deg)" },
  ];
}

/** 画面上の1px が盤面の座標で何マスにあたるか。大きさを測れない環境では 0 を返し、押し戻さない。 */
function measureUnitsPerPixel(
  svg: SVGSVGElement | null,
  viewBoxWidth: number,
): number {
  const width = svg?.getBoundingClientRect().width ?? 0;
  return width > 0 ? viewBoxWidth / width : 0;
}

export const _private = { createBrittleRockHoldKeyframes };
