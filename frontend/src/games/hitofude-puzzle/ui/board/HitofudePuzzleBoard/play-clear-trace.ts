import { hitofudePuzzleFigureParts } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 道を1マスなぞる時間。道の長さに比べて短すぎも長すぎもしないよう、全体の長さは下の範囲に収める。 */
const CLEAR_TRACE_MS_PER_CELL = 28;
const CLEAR_TRACE_MIN_MS = 640;
const CLEAR_TRACE_MAX_MS = 1_400;
/** なぞる光が終点に着いたときに、終点の印を膨らませて置く時間。 */
const END_MARK_POP_MS = 360;
const endMarkPopKeyframes: Keyframe[] = [
  { transform: "scale(0)" },
  { transform: "scale(1.5)", offset: 0.6 },
  { transform: "scale(1)" },
];
/**
 * なぞり終えた道を、結果へ進める前に見せておく時間。完成した道の形がこのゲームの報酬なので、
 * 道全体を見渡せる間を置く。
 * 終点の印を置いたときの音（`assets/sounds/cleared-end.flac`）は、印を置いてからこの間に鳴り終える長さで作っているので、変えるなら作り直す。
 */
const CLEAR_TRACE_HOLD_MS = 1_000;
/**
 * 動きを減らす設定で、完成した道を結果へ進める前に見せておく時間。光でなぞる時間が無い分を足し、
 * 動かす設定でなぞり始めてから結果へ進むまでと同じくらい、完成した道を見られるようにする。
 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 2_000;

const clearTraceKeyframes: Keyframe[] = [
  { strokeDashoffset: 1 },
  { strokeDashoffset: 0 },
];

/** 道を始点から終点まで光でなぞる時間。なぞり終えたときに終点の印を置く。 */
export function getClearTraceDurationMs(cellCount: number): number {
  return Math.min(
    CLEAR_TRACE_MAX_MS,
    Math.max(CLEAR_TRACE_MIN_MS, cellCount * CLEAR_TRACE_MS_PER_CELL),
  );
}

/**
 * クリアした道を、始点から終点へ光でなぞり、着いた所で終点の印を膨らませて置いてから `onFinished` を呼ぶ。
 * 戻り値は演出を取り消す関数。動きを減らす設定では、なぞり終えた光と終点の印を出したまま見せる。
 */
export function playClearTrace(
  figure: SVGSVGElement | null,
  cellCount: number,
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      const traceDurationMs = getClearTraceDurationMs(cellCount);
      const trace = figure
        ?.querySelector(`[${hitofudePuzzleFigureParts.clearTrace}]`)
        ?.animate?.(clearTraceKeyframes, {
          duration: traceDurationMs,
          easing: MOTION_EASING.celebrate,
          fill: "backwards",
        });
      const endMark = figure
        ?.querySelector(`[${hitofudePuzzleFigureParts.endMark}]`)
        ?.animate?.(endMarkPopKeyframes, {
          duration: END_MARK_POP_MS,
          delay: traceDurationMs,
          easing: MOTION_EASING.celebrate,
          fill: "backwards",
        });
      return [trace, endMark].filter((animation) => animation !== undefined);
    },
    completion: { type: "after-animations", holdMs: CLEAR_TRACE_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
