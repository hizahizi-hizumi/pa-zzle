import {
  type CSSProperties,
  type PointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { getWaterSortTopColorUnits } from "@/games/water-sort/puzzle/rules";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  bottleAspectRatio,
  getBoardLayout,
} from "@/games/water-sort/ui/board/board-layout";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { WaterSortTransferBottle } from "@/games/water-sort/ui/WaterSortPlay/WaterSortTransferBottle";
import {
  getWaterSortTransferDurationMs,
  type WaterSortExperience,
} from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";
import { playRejectionShake, prefersReducedMotion } from "@/lib/motion";
import "@/games/water-sort/ui/WaterSortPlay/water-sort-experience.css";

type PouredOperation = Extract<WaterSortOperation, { type: "poured" }>;

type WaterSortExperimentBoardProps = {
  experience: Exclude<WaterSortExperience, "classic">;
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  onPourBottle?: (
    sourceBottleIndex: number,
    destinationBottleIndex: number,
  ) => void;
  interactionDisabled: boolean;
  onPourAnimationActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
};

const FINISHED_BOTTLE_DURATION_MS = 560;
const tallBottleAspectRatio = 0.42;

function transferDuration(operation: PouredOperation): number {
  const source = operation.sourceBottleIndex;
  return getWaterSortTransferDurationMs(
    (operation.stateBefore[source]?.length ?? 0) -
      (operation.stateAfter[source]?.length ?? 0),
  );
}

function isTouchingTopLiquid(
  bottle: readonly number[],
  rect: DOMRect,
  pointerY: number,
): boolean {
  if (!rect.height) return true;
  const count = getWaterSortTopColorUnits(bottle);
  if (!count) return false;
  const bottom = rect.bottom - 4;
  const slotHeight = (rect.height - 16) / 4;
  const groupTop = bottom - slotHeight * bottle.length;
  const groupBottom = groupTop + slotHeight * count;
  return pointerY >= groupTop - 10 && pointerY <= groupBottom + 10;
}

type FloatingLiquid = {
  x: number;
  y: number;
  color: string;
  sourceIndex: number;
  width: number;
  height: number;
};

type Drag = {
  pointerId: number;
  sourceIndex: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function widthForBoardHeight(
  aspectRatio: number,
  columns: number,
  rows: number,
  columnGap: number,
  rowGap: number,
): string {
  return `calc((100cqh - ${rowGap * (rows - 1)}px) * ${(aspectRatio * columns) / rows} + ${columnGap * (columns - 1)}px)`;
}

export function WaterSortExperimentBoard({
  experience,
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  onPourBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortExperimentBoardProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const lastAnimatedId = useRef<number | null>(
    operation?.type === "poured" ? operation.id : null,
  );
  const [activePour, setActivePour] = useState<PouredOperation | null>(null);
  const [floatingLiquid, setFloatingLiquid] = useState<FloatingLiquid | null>(
    null,
  );
  const [justFinishedId, setJustFinishedId] = useState<number | null>(null);
  const [justSettledId, setJustSettledId] = useState<number | null>(null);

  useLayoutEffect(() => {
    setJustSettledId(null);
    if (operation?.type !== "poured") {
      setActivePour(null);
      return;
    }
    if (lastAnimatedId.current === operation.id) return;
    lastAnimatedId.current = operation.id;
    if (prefersReducedMotion()) {
      if (operation.isClearingMove) onClearAnimationComplete?.();
      return;
    }
    setActivePour(operation);
    onPourAnimationActivityChange?.(true);
    const durationMs = transferDuration(operation);
    let transferFinished = false;
    let settleTimeout: number | null = null;
    const transferTimeout = window.setTimeout(() => {
      transferFinished = true;
      setActivePour(null);
      const destination =
        operation.stateAfter[operation.destinationBottleIndex];
      if (destination && !isCompleteWaterSortBottle(destination)) {
        setJustSettledId(operation.destinationBottleIndex);
        settleTimeout = window.setTimeout(() => setJustSettledId(null), 240);
      }
      onPourAnimationActivityChange?.(false);
    }, durationMs);
    const clearTimeout = operation.isClearingMove
      ? window.setTimeout(
          () => onClearAnimationComplete?.(),
          durationMs + FINISHED_BOTTLE_DURATION_MS,
        )
      : null;
    return () => {
      window.clearTimeout(transferTimeout);
      if (settleTimeout !== null) window.clearTimeout(settleTimeout);
      if (clearTimeout !== null) window.clearTimeout(clearTimeout);
      if (!transferFinished) onPourAnimationActivityChange?.(false);
      if (lastAnimatedId.current === operation.id)
        lastAnimatedId.current = null;
    };
  }, [operation, onClearAnimationComplete, onPourAnimationActivityChange]);

  useLayoutEffect(() => {
    setJustFinishedId(null);
    if (operation?.type !== "poured") return;
    const destination = operation.destinationBottleIndex;
    const bottle = operation.stateAfter[destination];
    const wasComplete = operation.stateBefore[destination];
    if (
      !bottle ||
      !wasComplete ||
      !isCompleteWaterSortBottle(bottle) ||
      isCompleteWaterSortBottle(wasComplete)
    )
      return;
    setJustFinishedId(destination);
    const timeout = window.setTimeout(
      () => setJustFinishedId(null),
      transferDuration(operation) + FINISHED_BOTTLE_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [operation]);

  useLayoutEffect(() => {
    if (operation?.type !== "invalid") return;
    const bottle = refs.current[operation.bottleIndex];
    playRejectionShake(
      bottle,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" },
      ],
      { durationMs: 220, easing: "ease-out" },
    );
  }, [operation]);

  function findTarget(
    sourceIndex: number,
    x: number,
    y: number,
  ): number | null {
    let best: number | null = null;
    let distance = Number.POSITIVE_INFINITY;
    refs.current.forEach((element, index) => {
      if (!element || index === sourceIndex) return;
      const rect = element.getBoundingClientRect();
      if (
        x < rect.left - 9 ||
        x > rect.right + 9 ||
        y < rect.top - 9 ||
        y > rect.bottom + 9
      )
        return;
      const d = Math.hypot(
        x - (rect.left + rect.right) / 2,
        y - (rect.top + rect.bottom) / 2,
      );
      if (d < distance) {
        distance = d;
        best = index;
      }
    });
    return best;
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (
      experience !== "touch" ||
      !onPourBottle ||
      interactionDisabled ||
      event.button !== 0
    )
      return;
    const bottle = state[index];
    if (
      !bottle?.length ||
      isCompleteWaterSortBottle(bottle) ||
      !isTouchingTopLiquid(
        bottle,
        event.currentTarget.getBoundingClientRect(),
        event.clientY,
      )
    )
      return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      sourceIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 9
    )
      return;
    drag.moved = true;
    const source = state[drag.sourceIndex] ?? [];
    const topColor = source.at(-1);
    if (topColor === undefined) return;
    const amount = getWaterSortTopColorUnits(source);
    setFloatingLiquid({
      x: event.clientX,
      y: event.clientY,
      color: getWaterColorView(topColor).color,
      sourceIndex: drag.sourceIndex,
      width: Math.max(24, event.currentTarget.offsetWidth - 10),
      height:
        Math.max(16, (event.currentTarget.offsetHeight - 16) / 4) * amount,
    });
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setFloatingLiquid(null);
    if (!drag.moved) return;
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const target = findTarget(drag.sourceIndex, event.clientX, event.clientY);
    if (target !== null) onPourBottle?.(drag.sourceIndex, target);
  }

  function cancelDrag() {
    dragRef.current = null;
    setFloatingLiquid(null);
  }

  const layout = getBoardLayout(state.length);
  const tallLayout = {
    ...layout,
    columnCount: Math.ceil(state.length / 3),
    columnGap: 12,
    rowGap: 14,
  };
  const compactRows = Math.ceil(state.length / layout.columnCount);
  const tallRows = Math.ceil(state.length / tallLayout.columnCount);

  const gridStyle = {
    "--water-sort-compact-grid-width": `min(${layout.width}, ${widthForBoardHeight(bottleAspectRatio, layout.columnCount, compactRows, layout.columnGap, layout.rowGap)})`,
    "--water-sort-tall-grid-width": `min(${layout.width}, ${widthForBoardHeight(tallBottleAspectRatio, tallLayout.columnCount, tallRows, tallLayout.columnGap, tallLayout.rowGap)})`,
    "--water-sort-compact-columns": layout.columnCount,
    "--water-sort-tall-columns": tallLayout.columnCount,
    "--water-sort-compact-column-gap": `${layout.columnGap}px`,
    "--water-sort-tall-column-gap": `${tallLayout.columnGap}px`,
    "--water-sort-compact-row-gap": `${layout.rowGap}px`,
    "--water-sort-tall-row-gap": `${tallLayout.rowGap}px`,
  } as CSSProperties;

  return (
    <div className="relative flex size-full min-h-0 flex-col items-center justify-center">
      <div className="flex size-full min-h-0 items-center justify-center [container-type:size]">
        <fieldset
          className="water-sort-experiment-grid grid w-full items-end justify-center border-0 p-0"
          data-tall-layout={state.length >= 12}
          data-bottle-count={state.length}
          style={gridStyle}
        >
          {state.map((bottle, index) => {
            const bottleLabel = `ボトル ${index + 1}`;
            const colorNames =
              bottle.length === 0
                ? "空"
                : bottle
                    .map((color) => getWaterColorView(color).name)
                    .join("、");
            const isSource = sourceBottleIndex === index;
            return (
              <button
                key={bottleLabel}
                type="button"
                ref={(element) => {
                  refs.current[index] = element;
                }}
                aria-label={`${bottleLabel}: ${colorNames}${isCompleteWaterSortBottle(bottle) ? "（完成）" : ""}`}
                aria-pressed={isSource}
                onClick={() => {
                  if (!suppressClickRef.current) onSelectBottle(index);
                }}
                onPointerDown={(event) => beginDrag(event, index)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
                disabled={interactionDisabled}
                className={`water-sort-experiment-item relative w-full origin-top cursor-pointer rounded-b-[1.45rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${experience === "touch" ? "touch-none" : "touch-manipulation"} ${isSource ? "-translate-y-2 transition-transform duration-(--duration-normal)" : "transition-transform duration-(--duration-normal)"}`}
              >
                <WaterSortTransferBottle
                  bottle={bottle}
                  index={index}
                  operation={activePour}
                  justFinished={justFinishedId === index && !activePour}
                  justSettled={justSettledId === index && !activePour}
                  held={floatingLiquid?.sourceIndex === index}
                  selected={isSource}
                />
              </button>
            );
          })}
        </fieldset>
      </div>
      {floatingLiquid && (
        <span
          aria-hidden="true"
          data-testid="floating-water"
          className="water-sort-floating-liquid"
          style={{
            left: floatingLiquid.x,
            top: floatingLiquid.y,
            backgroundColor: floatingLiquid.color,
            width: floatingLiquid.width,
            height: floatingLiquid.height,
          }}
        >
          <span className="water-sort-floating-liquid-surface" />
        </span>
      )}
    </div>
  );
}
