import { hamiltonianPathFigureParts } from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 道を1マスなぞる時間。道の長さに比べて短すぎも長すぎもしないよう、全体の長さは下の範囲に収める。 */
const CLEAR_TRACE_MS_PER_CELL = 28;
const CLEAR_TRACE_MIN_MS = 640;
const CLEAR_TRACE_MAX_MS = 1_400;
/**
 * なぞり終えた道を、結果へ進める前に見せておく時間。完成した道の形がこのゲームの報酬なので、
 * 完成した形を報酬にするリフレクションの全光路と同じ間を置き、動きを減らす設定でも同じ間を残す。
 */
const CLEAR_TRACE_HOLD_MS = 700;

const clearTraceKeyframes: Keyframe[] = [
  { strokeDashoffset: 1 },
  { strokeDashoffset: 0 },
];

function getClearTraceDurationMs(cellCount: number): number {
  return Math.min(
    CLEAR_TRACE_MAX_MS,
    Math.max(CLEAR_TRACE_MIN_MS, cellCount * CLEAR_TRACE_MS_PER_CELL),
  );
}

/**
 * クリアした道を、始点から終点へ光でなぞってから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * 動きを減らす設定では、なぞり終えた光を出したまま同じ間だけ見せる。
 */
export function playClearTrace(
  figure: SVGSVGElement | null,
  cellCount: number,
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      const trace = figure?.querySelector(
        `[${hamiltonianPathFigureParts.clearTrace}]`,
      );
      const animation = trace?.animate?.(clearTraceKeyframes, {
        duration: getClearTraceDurationMs(cellCount),
        easing: MOTION_EASING.celebrate,
        fill: "backwards",
      });
      return animation === undefined ? [] : [animation];
    },
    completion: { type: "after-animations", holdMs: CLEAR_TRACE_HOLD_MS },
    reducedMotionHoldMs: CLEAR_TRACE_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
