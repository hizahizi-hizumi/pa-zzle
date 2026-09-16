import { useEffect, useRef } from "react";

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

const pourAnimationDurationMs = 760;
const revealDestinationDelayMs = 470;
const activeBottlePresentations = new WeakMap<HTMLButtonElement, () => void>();

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  onSelectBottle: (bottleIndex: number) => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  selectableBottleIndexes,
  onSelectBottle,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    return () => {
      for (const bottle of bottleRefs.current) {
        if (bottle) {
          activeBottlePresentations.get(bottle)?.();
        }
      }
    };
  }, []);

  const selectBottle = (bottleIndex: number) => {
    const clickedBottle = bottleRefs.current[bottleIndex];
    if (clickedBottle) {
      activeBottlePresentations.get(clickedBottle)?.();
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

    animatePour(sourceBottle, destinationBottle);
    onSelectBottle(bottleIndex);
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
  activeBottlePresentations.get(sourceBottle)?.();
  activeBottlePresentations.get(destinationBottle)?.();

  const sourceRect = sourceBottle.getBoundingClientRect();
  const destinationRect = destinationBottle.getBoundingClientRect();
  const sourceGhost = createBottleGhost(sourceBottle, sourceRect, 30);
  const destinationGhost = createBottleGhost(
    destinationBottle,
    destinationRect,
    25,
  );
  document.body.append(sourceGhost, destinationGhost);

  sourceBottle.style.opacity = "0";
  sourceBottle.style.pointerEvents = "none";

  const deltaX = destinationRect.left - sourceRect.left;
  const deltaY = destinationRect.top - sourceRect.top;
  const hoverY = deltaY - sourceRect.height * 0.78;
  const direction = deltaX >= 0 ? 1 : -1;
  let destinationRevealed = false;
  let cleaned = false;

  const revealDestination = () => {
    if (destinationRevealed) {
      return;
    }
    destinationRevealed = true;
    destinationGhost.remove();
    destinationBottle.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.035)" },
        { transform: "scale(1)" },
      ],
      { duration: 300, easing: "ease-out" },
    );
  };

  const revealTimer = window.setTimeout(
    revealDestination,
    revealDestinationDelayMs,
  );

  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    window.clearTimeout(revealTimer);
    revealDestination();
    sourceAnimation.cancel();
    sourceGhost.remove();
    sourceBottle.style.opacity = "";
    sourceBottle.style.pointerEvents = "";
    if (activeBottlePresentations.get(sourceBottle) === cleanup) {
      activeBottlePresentations.delete(sourceBottle);
    }
    if (activeBottlePresentations.get(destinationBottle) === cleanup) {
      activeBottlePresentations.delete(destinationBottle);
    }
  };

  activeBottlePresentations.set(sourceBottle, cleanup);
  activeBottlePresentations.set(destinationBottle, cleanup);

  const sourceAnimation = sourceGhost.animate(
    [
      { transform: "translateY(0) rotate(0deg)", offset: 0 },
      { transform: "translateY(-10px) rotate(0deg)", offset: 0.16 },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
        offset: 0.46,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 20}deg)`,
        offset: 0.6,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 20}deg)`,
        offset: 0.76,
      },
      {
        transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
        offset: 0.86,
      },
      { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
    ],
    {
      duration: pourAnimationDurationMs,
      easing: "cubic-bezier(.4,0,.2,1)",
    },
  );
  void sourceAnimation.finished.then(cleanup, cleanup);
}

function createBottleGhost(
  bottle: HTMLButtonElement,
  rect: DOMRect,
  zIndex: number,
): HTMLButtonElement {
  const ghost = bottle.cloneNode(true) as HTMLButtonElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.removeAttribute("aria-label");
  ghost.removeAttribute("aria-pressed");
  ghost.removeAttribute("data-selected");
  ghost.tabIndex = -1;
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.margin = "0";
  ghost.style.pointerEvents = "none";
  ghost.style.transition = "none";
  ghost.style.zIndex = String(zIndex);
  return ghost;
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
