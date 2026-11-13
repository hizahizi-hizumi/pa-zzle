import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type MinesweeperClearAnimationProps = {
  active: boolean;
  /** 盤面の列の数。照らす波を広げる距離を、マスの位置から求める。 */
  columns: number;
  /** 照らす波を始める、最後に開けたマス。無ければ左上から始める。 */
  originCellIndex?: number | null;
  onComplete: () => void;
  children: ReactNode;
};

/** クリア音（`assets/sounds/cleared.flac`）に合わせた盤面完成の長さ。 */
const CELL_HIGHLIGHT_MS = 300;
const WAVE_SPREAD_MS = 420;
const CLEAR_HOLD_MS = 160;
const CLEAR_UNANIMATED_HOLD_MS =
  CELL_HIGHLIGHT_MS + WAVE_SPREAD_MS + CLEAR_HOLD_MS;

/** 開いた面を明るく照らし、少し浮かせてから戻す。 */
const cellHighlightKeyframes: Keyframe[] = [
  { filter: "brightness(1) saturate(1)", transform: "scale(1)" },
  {
    filter: "brightness(1.4) saturate(1.3)",
    transform: "scale(1.1)",
    offset: 0.4,
  },
  { filter: "brightness(1) saturate(1)", transform: "scale(1)" },
];

function getDistance(
  columns: number,
  fromCellIndex: number,
  toCellIndex: number,
): number {
  return Math.hypot(
    Math.floor(fromCellIndex / columns) - Math.floor(toCellIndex / columns),
    (fromCellIndex % columns) - (toCellIndex % columns),
  );
}

/** 旗を動かさず、完成した安全マスだけを、最後に開けたマスから距離の順に照らす。 */
function animateCompletedCells(
  container: HTMLElement,
  columns: number,
  originCellIndex: number,
): Animation[] {
  const cells = Array.from(
    container.querySelectorAll<HTMLElement>('[data-cell-state="revealed"]'),
  ).map((cell) => ({
    cell,
    distance: getDistance(
      columns,
      originCellIndex,
      Number(cell.dataset.cellIndex ?? originCellIndex),
    ),
  }));
  const farthest = Math.max(1, ...cells.map(({ distance }) => distance));
  return cells.flatMap(
    ({ cell, distance }) =>
      cell.animate?.(cellHighlightKeyframes, {
        duration: CELL_HIGHLIGHT_MS,
        delay: Math.round((distance / farthest) * WAVE_SPREAD_MS),
        easing: MOTION_EASING.celebrate,
      }) ?? [],
  );
}

/** 最終操作で開いた盤面を見せ、完成の余韻を作ってから結果へ進む。 */
export function MinesweeperClearAnimation({
  active,
  columns,
  originCellIndex = null,
  onComplete,
  children,
}: MinesweeperClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 波の起点は始めたときのマスで決め、演出の途中で知らせが変わっても波を作り直さない。
  const animate = useEffectEvent(function animate() {
    const container = containerRef.current;
    return container
      ? animateCompletedCells(container, columns, originCellIndex ?? 0)
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
    </div>
  );
}
