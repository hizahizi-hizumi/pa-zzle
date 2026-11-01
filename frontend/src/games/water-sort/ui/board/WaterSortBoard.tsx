import { useLayoutEffect, useRef } from "react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled: boolean;
  /**
   * ボトルの並べ方。
   * - `rows`: 本数に応じて2段に分けて並べる。
   * - `single-row`: すべてを1段に並べ、置かれた場所の幅いっぱいに広げる。
   */
  arrangement?: "rows" | "single-row";
  cues?: readonly WaterSortBottleCue[];
  onPourAnimationActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
};

const invalidBottleShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-4px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];

const invalidBottleShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  arrangement = "rows",
  cues = [],
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { animations, finishAnimation, interruptForBottleInteraction } =
    usePourAnimations({
      operation,
      bottleRefs,
      onActivityChange: onPourAnimationActivityChange,
      onClearAnimationComplete,
    });

  useLayoutEffect(() => {
    if (operation?.type === "invalid") {
      playRejectionShake(
        bottleRefs.current[operation.bottleIndex],
        invalidBottleShakeKeyframes,
        invalidBottleShakeTiming,
      );
    }
  }, [operation]);

  function selectBottle(bottleIndex: number) {
    if (interactionDisabled) {
      return;
    }
    if (sourceBottleIndex === null) {
      interruptForBottleInteraction(bottleIndex);
    }
    onSelectBottle(bottleIndex);
  }

  const animatedBottleIndexes = new Set(
    animations.flatMap((animation) => [
      animation.source.bottleIndex,
      animation.destination.bottleIndex,
    ]),
  );
  const layout =
    arrangement === "single-row"
      ? getSingleRowLayout(state.length)
      : getBoardLayout(state.length);

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
          const bottleCues = cues.filter(
            (item) => item.bottleIndex === bottleIndex,
          );

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
              className="relative aspect-[0.36] w-full origin-top cursor-pointer touch-manipulation rounded-b-[1.45rem] transition-transform duration-(--duration-normal) ease-enter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              disabled={interactionDisabled}
            >
              <span
                className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
              >
                <WaterBottle contents={bottle} selected={isSource} />
              </span>
              {bottleCues.map((cue) =>
                cue.kind === "rejected" ? (
                  <span
                    key={`${cue.kind}-${cue.id}`}
                    aria-hidden="true"
                    data-bottle-cue={cue.kind}
                    className="pointer-events-none absolute -inset-x-1 top-1 -bottom-1 rounded-b-[1.7rem] rounded-t-md ring-[3px] ring-destructive fill-mode-forwards animate-out fade-out-0 duration-900 ease-in"
                  />
                ) : cue.kind === "hint" ? (
                  <span
                    key={`${cue.kind}-${cue.id}`}
                    aria-hidden="true"
                    data-bottle-cue={cue.kind}
                    className="pointer-events-none absolute -inset-1.5 top-0.5 rounded-b-[1.8rem] rounded-t-lg border-[3px] border-sky-600 border-dashed animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:border-sky-400"
                  />
                ) : (
                  <span
                    key={`${cue.kind}-${cue.id}`}
                    aria-hidden="true"
                    data-bottle-cue={cue.kind}
                    className={`pointer-events-none absolute -inset-x-1 top-1 -bottom-1 rounded-b-[1.7rem] rounded-t-md shadow-[0_0_14px_3px] shadow-emerald-400/70 ring-[3px] ring-emerald-500/80 dark:shadow-emerald-300/60 dark:ring-emerald-300/80 ${
                      cue.kind === "sorted"
                        ? "fill-mode-forwards animate-out fade-out-0 duration-900 ease-in"
                        : "animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none"
                    }`}
                  />
                ),
              )}
            </button>
          );
        })}
      </fieldset>

      <PourAnimationLayer animations={animations} onFinish={finishAnimation} />
    </>
  );
}

function getSingleRowLayout(bottleCount: number) {
  return {
    columnCount: bottleCount,
    width: "100%",
    columnGap: 14,
    rowGap: 0,
  };
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
