import { useLayoutEffect, useRef } from "react";
import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { PourAnimationLayer } from "./pour/PourAnimationLayer";
import { usePourAnimations } from "./pour/use-pour-animations";
import { getWaterColorView } from "./water-bottle/get-water-color-view";
import { WaterBottle } from "./water-bottle/WaterBottle";

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled?: boolean;
  onPourAnimationActivityChange?: (active: boolean) => void;
  onClearingPourComplete?: () => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled = false,
  onPourAnimationActivityChange,
  onClearingPourComplete,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { animations, finishAnimation, interruptForBottleInteraction } =
    usePourAnimations({
      operation,
      bottleRefs,
      onActivityChange: onPourAnimationActivityChange,
      onClearingPourComplete,
    });

  useLayoutEffect(() => {
    if (operation?.type === "invalid") {
      animateInvalidBottle(bottleRefs.current[operation.bottleIndex]);
    }
  }, [operation]);

  const selectBottle = (bottleIndex: number) => {
    if (interactionDisabled) {
      return;
    }
    if (sourceBottleIndex === null) {
      interruptForBottleInteraction(bottleIndex);
    }
    onSelectBottle(bottleIndex);
  };

  const animatedBottleIndexes = new Set(
    animations.flatMap((animation) => [
      animation.source.bottleIndex,
      animation.destination.bottleIndex,
    ]),
  );
  const layout = getBoardLayout(state.length);

  return (
    <>
      <fieldset
        className="grid w-full items-end justify-center border-0 p-0"
        style={{
          gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
          columnGap: layout.columnGap,
          rowGap: layout.rowGap,
          width: layout.width,
        }}
      >
        {state.map((bottle, bottleIndex) => {
          const bottleLabel = `ボトル ${bottleIndex + 1}`;
          const contents =
            bottle.length === 0
              ? "空"
              : bottle
                  .map((colorIndex) => getWaterColorView(colorIndex).name)
                  .join("、");
          const isSource = bottleIndex === sourceBottleIndex;
          const isAnimated = animatedBottleIndexes.has(bottleIndex);

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
              className="relative aspect-[0.36] w-full origin-top cursor-pointer touch-manipulation rounded-b-[1.45rem] transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              disabled={interactionDisabled}
            >
              <span
                className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
              >
                <WaterBottle contents={bottle} selected={isSource} />
              </span>
            </button>
          );
        })}
      </fieldset>

      <PourAnimationLayer animations={animations} onFinish={finishAnimation} />
    </>
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
