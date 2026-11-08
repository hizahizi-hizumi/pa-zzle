import { type PointerEvent, useLayoutEffect, useRef } from "react";
import type {
  WaterSortOperation,
  WaterSortPourGesture,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { paintGlassBottle } from "@/games/water-sort/ui/board/water-bottle/glass-bottle-renderer";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

type WaterSortBoardProps = {
  state: WaterSortState;
  appearance?: WaterSortAppearance;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  onPourBottle?: (
    sourceBottleIndex: number,
    destinationBottleIndex: number,
    gesture?: WaterSortPourGesture,
  ) => void;
  interactionDisabled: boolean;
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

const bottleAspectRatio = 0.36;

export function WaterSortBoard({
  state,
  appearance = "classic",
  sourceBottleIndex,
  operation,
  onSelectBottle,
  onPourBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pointerGestureRef = useRef<{
    pointerId: number;
    sourceIndex: number;
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const currentDropTargetRef = useRef<number | null>(null);

  function detectDropTarget(sourceIndex: number, x: number, y: number) {
    return bottleRefs.current.findIndex((bottle, index) => {
      if (!bottle || index === sourceIndex) return false;
      const rect = bottle.getBoundingClientRect();
      return (
        x >= rect.left - 12 &&
        x <= rect.right + 12 &&
        y >= rect.top - 12 &&
        y <= rect.bottom + 12
      );
    });
  }

  function markDropTarget(index: number | null) {
    if (currentDropTargetRef.current === index) return;
    bottleRefs.current[currentDropTargetRef.current ?? -1]?.removeAttribute(
      "data-water-sort-drop-target",
    );
    if (index !== null)
      bottleRefs.current[index]?.setAttribute(
        "data-water-sort-drop-target",
        "true",
      );
    currentDropTargetRef.current = index;
  }

  function beginDrag(
    event: PointerEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (!onPourBottle || interactionDisabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      sourceIndex,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging && Math.hypot(dx, dy) < 12) return;
    if (!gesture.dragging) gesture.dragging = true;
    const element = event.currentTarget;
    element.style.transition = "none";
    element.style.zIndex = "10";
    const tilt = Math.max(-12, Math.min(12, dx / 18));
    element.style.transform = `translate(${dx}px, ${dy - 12}px) rotate(${tilt}deg)`;
    const canvas = element.querySelector<HTMLCanvasElement>(
      "[data-water-sort-glass]",
    );
    const contents = state[gesture.sourceIndex];
    if (canvas && contents)
      paintGlassBottle(canvas, { contents, tiltDegrees: tilt });
    element.style.filter = "drop-shadow(0 12px 13px rgba(20,43,50,.22))";
    const target = detectDropTarget(
      gesture.sourceIndex,
      event.clientX,
      event.clientY,
    );
    markDropTarget(target >= 0 ? target : null);
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    pointerGestureRef.current = null;
    const element = event.currentTarget;
    element.style.removeProperty("transition");
    element.style.removeProperty("z-index");
    element.style.removeProperty("transform");
    element.style.removeProperty("filter");
    if (!gesture.dragging) return;
    const canvas = element.querySelector<HTMLCanvasElement>(
      "[data-water-sort-glass]",
    );
    const contents = state[gesture.sourceIndex];
    if (canvas && contents) paintGlassBottle(canvas, { contents });
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const candidate = detectDropTarget(
      gesture.sourceIndex,
      event.clientX,
      event.clientY,
    );
    markDropTarget(null);
    if (candidate >= 0) {
      onPourBottle?.(gesture.sourceIndex, candidate, {
        offsetX: event.clientX - gesture.x,
        offsetY: event.clientY - gesture.y - 12,
        tiltDegrees: Math.max(
          -12,
          Math.min(12, (event.clientX - gesture.x) / 18),
        ),
      });
    }
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    const gesture = pointerGestureRef.current;
    pointerGestureRef.current = null;
    markDropTarget(null);
    const element = event.currentTarget;
    element.style.removeProperty("transition");
    element.style.removeProperty("z-index");
    element.style.removeProperty("transform");
    element.style.removeProperty("filter");
    const canvas = element.querySelector<HTMLCanvasElement>(
      "[data-water-sort-glass]",
    );
    const contents = gesture && state[gesture.sourceIndex];
    if (canvas && contents) paintGlassBottle(canvas, { contents });
  }

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
  const layout = getBoardLayout(state.length);
  const rowCount = Math.ceil(state.length / layout.columnCount);
  // ボトルの縦横比と隙間を保ったまま、見出し・下端を除いた高さにも収める。
  const widthForAvailableHeight = `calc((100cqh - ${layout.rowGap * (rowCount - 1)}px) * ${(bottleAspectRatio * layout.columnCount) / rowCount} + ${layout.columnGap * (layout.columnCount - 1)}px)`;

  return (
    <>
      <div className="flex size-full items-center justify-center [container-type:size]">
        <fieldset
          className="grid w-full items-end justify-center border-0 p-0"
          style={{
            gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
            columnGap: layout.columnGap,
            rowGap: layout.rowGap,
            width: `min(${layout.width}, ${widthForAvailableHeight})`,
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
                onPointerDown={(event) => beginDrag(event, bottleIndex)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
                onClick={() => {
                  if (!suppressClickRef.current) selectBottle(bottleIndex);
                }}
                className={`relative w-full origin-top cursor-pointer touch-none rounded-b-[1.45rem] transition-transform duration-(--duration-normal) ease-enter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 data-[water-sort-drop-target=true]:ring-2 data-[water-sort-drop-target=true]:ring-[#598a91] data-[water-sort-drop-target=true]:ring-offset-3 ${isSource && appearance !== "classic" ? "-translate-y-2" : ""}`}
                style={{ aspectRatio: bottleAspectRatio }}
                disabled={interactionDisabled}
              >
                <span
                  className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
                >
                  <WaterBottle
                    contents={bottle}
                    selected={isSource}
                    appearance={appearance}
                  />
                </span>
              </button>
            );
          })}
        </fieldset>
      </div>

      {/* 注ぐ演出はviewport座標を使うので、サイズを制約するコンテナの外へ置く。 */}
      <PourAnimationLayer
        animations={animations}
        onFinish={finishAnimation}
        appearance={appearance}
      />
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
