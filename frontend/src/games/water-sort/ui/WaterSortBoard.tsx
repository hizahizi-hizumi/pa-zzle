import { useEffect, useRef, useState } from "react";

import type { WaterSortState } from "@/games/water-sort/game/state";

const waterSortColors = [
  { label: "赤", color: "#ef5350" },
  { label: "青", color: "#4d7ee8" },
  { label: "緑", color: "#35b96b" },
  { label: "黄", color: "#f2c94c" },
  { label: "紫", color: "#9b6de3" },
  { label: "橙", color: "#f2994a" },
  { label: "水色", color: "#42b9d3" },
  { label: "桃", color: "#df6ca6" },
  { label: "黄緑", color: "#9fc84a" },
  { label: "紺", color: "#3856a6" },
  { label: "茶", color: "#a96d45" },
  { label: "青緑", color: "#269a91" },
] as const;

const bottleSlots = [0, 1, 2, 3] as const;

const pourAnimationDurationMs = 520;
const applyMoveDelayMs = 300;

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  onSelectBottle: (bottleIndex: number) => void;
  onBusyChange?: (busy: boolean) => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  selectableBottleIndexes,
  onSelectBottle,
  onBusyChange,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const timersRef = useRef<number[]>([]);
  const [isPouring, setIsPouring] = useState(false);

  useEffect(() => {
    return () => {
      for (const timerId of timersRef.current) {
        window.clearTimeout(timerId);
      }
      onBusyChange?.(false);
    };
  }, [onBusyChange]);

  const schedule = (callback: () => void, delayMs: number) => {
    const timerId = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((id) => id !== timerId);
      callback();
    }, delayMs);
    timersRef.current.push(timerId);
  };

  const selectBottle = (bottleIndex: number) => {
    if (isPouring) {
      return;
    }

    if (sourceBottleIndex === null || bottleIndex === sourceBottleIndex) {
      if (
        sourceBottleIndex === null &&
        !selectableBottleIndexes.has(bottleIndex)
      ) {
        animateInvalidBottle(bottleRefs.current[bottleIndex]);
      }
      onSelectBottle(bottleIndex);
      return;
    }

    if (!selectableBottleIndexes.has(bottleIndex)) {
      animateInvalidBottle(bottleRefs.current[bottleIndex]);
      onSelectBottle(bottleIndex);
      return;
    }

    const sourceBottle = bottleRefs.current[sourceBottleIndex];
    const destinationBottle = bottleRefs.current[bottleIndex];
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      !sourceBottle ||
      !destinationBottle ||
      !sourceBottle.animate ||
      prefersReducedMotion
    ) {
      onSelectBottle(bottleIndex);
      return;
    }

    setIsPouring(true);
    onBusyChange?.(true);
    animatePour(sourceBottle, destinationBottle);
    schedule(() => onSelectBottle(bottleIndex), applyMoveDelayMs);
    schedule(() => {
      setIsPouring(false);
      onBusyChange?.(false);
    }, pourAnimationDurationMs);
  };

  const layout = getBoardLayout(state.length);

  return (
    <fieldset
      className="grid w-full items-end justify-center border-0 p-0"
      style={{
        gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
        columnGap: layout.columnGap,
        rowGap: layout.rowGap,
        width: layout.width,
      }}
      aria-label="カラーウォーターソート盤面"
    >
      {state.map((bottle, bottleIndex) => {
        const bottleLabel = `ボトル ${bottleIndex + 1}`;
        const contents =
          bottle.length === 0
            ? "空"
            : bottle
                .map((colorIndex) => getColorView(colorIndex).label)
                .join("、");
        const isSource = bottleIndex === sourceBottleIndex;

        return (
          <button
            key={bottleLabel}
            ref={(element) => {
              bottleRefs.current[bottleIndex] = element;
            }}
            type="button"
            aria-label={`${bottleLabel}: ${contents}`}
            aria-pressed={isSource}
            onClick={() => selectBottle(bottleIndex)}
            className="group relative aspect-[0.36] w-full origin-top cursor-pointer touch-manipulation rounded-b-[1.45rem] transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 data-[selected=true]:-translate-y-2"
            data-selected={isSource || undefined}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-[4px] bottom-[4px] top-3 overflow-hidden rounded-b-[1.15rem] bg-black/[0.015]"
            >
              {bottleSlots.map((slotIndex) => {
                const colorIndex = bottle[slotIndex];
                if (colorIndex === undefined) {
                  return null;
                }

                const color = getColorView(colorIndex);
                return (
                  <span
                    key={`${slotIndex}-${colorIndex}-${bottle.length}`}
                    className="absolute inset-x-0 h-1/4 transition-[background-color] duration-200"
                    style={{
                      bottom: `${slotIndex * 25}%`,
                      backgroundColor: color.color,
                    }}
                  />
                );
              })}
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 top-2 rounded-b-[1.45rem] border-[3px] border-t-0 border-slate-400/55 shadow-[inset_0_-2px_5px_rgba(15,23,42,0.08),0_5px_12px_rgba(15,23,42,0.06)] transition-[border-color,filter] duration-150 group-data-[selected=true]:border-slate-500 group-data-[selected=true]:drop-shadow-md"
            />
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-0 h-[3px] w-[calc(100%-2px)] -translate-x-1/2 rounded-full bg-slate-400/55"
            />
          </button>
        );
      })}
    </fieldset>
  );
}

function getBoardLayout(bottleCount: number) {
  const columnCount = Math.max(3, Math.ceil(bottleCount / 2));

  if (columnCount >= 6) {
    return {
      columnCount,
      width: "min(100%, clamp(366px, 48vw, 570px))",
      columnGap: 10,
      rowGap: 34,
    };
  }
  if (columnCount === 5) {
    return {
      columnCount,
      width: "min(100%, clamp(360px, 44vw, 520px))",
      columnGap: 14,
      rowGap: 40,
    };
  }
  if (columnCount === 4) {
    return {
      columnCount,
      width: "min(100%, clamp(320px, 40vw, 450px))",
      columnGap: 16,
      rowGap: 42,
    };
  }
  return {
    columnCount,
    width: "min(100%, clamp(250px, 32vw, 340px))",
    columnGap: 18,
    rowGap: 44,
  };
}

function animateInvalidBottle(element: HTMLButtonElement | null | undefined) {
  if (!element?.animate) {
    return;
  }

  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(-2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
}

function animatePour(
  sourceBottle: HTMLButtonElement,
  destinationBottle: HTMLButtonElement,
) {
  const sourceRect = sourceBottle.getBoundingClientRect();
  const destinationRect = destinationBottle.getBoundingClientRect();
  const deltaX = destinationRect.left - sourceRect.left;
  const deltaY = destinationRect.top - sourceRect.top;
  const hoverY = deltaY - sourceRect.height - 8;
  const direction = deltaX >= 0 ? 1 : -1;

  sourceBottle.style.zIndex = "20";
  const sourceAnimation = sourceBottle.animate(
    [
      { transform: "translateY(-8px) rotate(0deg)", offset: 0 },
      { transform: "translateY(-30px) rotate(0deg)", offset: 0.2 },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
        offset: 0.5,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 24}deg)`,
        offset: 0.62,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 24}deg)`,
        offset: 0.72,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
        offset: 0.8,
      },
      { transform: "translateY(0) rotate(0deg)", offset: 1 },
    ],
    { duration: pourAnimationDurationMs, easing: "ease-in-out" },
  );
  void sourceAnimation.finished.finally(() => {
    sourceBottle.style.zIndex = "";
  });

  destinationBottle.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.04)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 220,
      delay: applyMoveDelayMs - 20,
      easing: "ease-out",
    },
  );
}

function getColorView(colorIndex: number) {
  const color = waterSortColors[colorIndex];
  if (!color) {
    return {
      label: `色 ${colorIndex + 1}`,
      color: `hsl(${(colorIndex * 47) % 360} 70% 58%)`,
    };
  }

  return color;
}
