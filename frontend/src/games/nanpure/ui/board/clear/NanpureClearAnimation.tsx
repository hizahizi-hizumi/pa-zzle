import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { NANPURE_SIZE } from "@/games/nanpure/puzzle/board";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type NanpureClearAnimationProps = {
  active: boolean;
  /** 波を始める、最後に数字を入れたマス。無ければ盤面の中央から始める。 */
  originCellIndex?: number | null;
  onComplete: () => void;
  children: ReactNode;
};

/** 盤面の数字を持つ要素。マスの番号を値に持つ。 */
const waveDigitSelector = "[data-nanpure-wave-cell]";
const CENTER_CELL_INDEX = (NANPURE_SIZE * NANPURE_SIZE - 1) / 2;

/** 波が起点から最も遠いマスへ届くまでの長さ。起点が隅でも中央でも、結果へ進むまでの長さを変えない。 */
export const CLEAR_WAVE_SPREAD_MS = 420;
const CLEAR_WAVE_MAX_STAGGER_MS = 40;
const CLEAR_JUMP_DURATION_MS = 360;
const CLEAR_JUMP_PEAK_OFFSET = 0.4;
export const CLEAR_JUMP_PEAK_MS =
  CLEAR_JUMP_DURATION_MS * CLEAR_JUMP_PEAK_OFFSET;
const CLEAR_HOLD_MS = 120;
/** 動かせない環境でも、波と同じ間を置いてから結果へ進める。 */
const CLEAR_UNANIMATED_HOLD_MS =
  CLEAR_WAVE_SPREAD_MS + CLEAR_JUMP_DURATION_MS + CLEAR_HOLD_MS;

const clearJumpKeyframes: Keyframe[] = [
  { transform: "translateY(0) scale(1)" },
  {
    transform: "translateY(-22%) scale(1.3)",
    offset: CLEAR_JUMP_PEAK_OFFSET,
  },
  { transform: "translateY(0) scale(1)" },
];

function getDistance(fromCellIndex: number, toCellIndex: number): number {
  return Math.hypot(
    Math.floor(fromCellIndex / NANPURE_SIZE) -
      Math.floor(toCellIndex / NANPURE_SIZE),
    (fromCellIndex % NANPURE_SIZE) - (toCellIndex % NANPURE_SIZE),
  );
}

/** 最後に入れたマスから、81マスの数字を距離の順に跳ねさせる。 */
function animateClearWave(
  container: HTMLElement,
  originCellIndex: number,
): Animation[] {
  const digits = Array.from(
    container.querySelectorAll<HTMLElement>(waveDigitSelector),
  ).map((element) => ({
    element,
    distance: getDistance(
      originCellIndex,
      Number(element.dataset.nanpureWaveCell ?? originCellIndex),
    ),
  }));
  const farthest = Math.max(1, ...digits.map(({ distance }) => distance));
  const stagger = Math.min(
    CLEAR_WAVE_MAX_STAGGER_MS,
    CLEAR_WAVE_SPREAD_MS / farthest,
  );

  return digits.flatMap(
    ({ element, distance }) =>
      element.animate?.(clearJumpKeyframes, {
        duration: CLEAR_JUMP_DURATION_MS,
        delay: Math.round(distance * stagger),
        easing: MOTION_EASING.celebrate,
      }) ?? [],
  );
}

export function NanpureClearAnimation({
  active,
  originCellIndex = null,
  onComplete,
  children,
}: NanpureClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 波の起点は始めたときのマスで決め、演出の途中で選びが変わっても波を作り直さない。
  const animate = useEffectEvent(function animate() {
    const container = containerRef.current;
    return container
      ? animateClearWave(container, originCellIndex ?? CENTER_CELL_INDEX)
      : [];
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate,
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: CLEAR_UNANIMATED_HOLD_MS,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-violet-200/15 dark:bg-violet-700/10"
        />
      )}
    </div>
  );
}
