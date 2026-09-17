import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { applyWaterSortMove } from "@/games/water-sort/game/rules";
import {
  isWaterSortCleared,
  type WaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/game/state";

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

const pourAnimationDurationMs = 1600;
const pourTransferStartOffset = 0.38;
const pourTransferEndOffset = 0.72;
const sourcePourLayerZIndex = 70;
const streamPourLayerZIndex = 69;
const destinationPourLayerZIndex = 65;

type BottleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PourPresentation = {
  id: number;
  sourceBottleIndex: number;
  destinationBottleIndex: number;
  sourceBefore: WaterSortBottle;
  sourceAfter: WaterSortBottle;
  destinationBefore: WaterSortBottle;
  destinationAfter: WaterSortBottle;
  pourColorIndex: number;
  isClearingMove: boolean;
  sourceRect: BottleRect;
  destinationRect: BottleRect;
};

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled?: boolean;
  onClearingPourStart?: () => void;
  onClearingPourComplete?: () => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  selectableBottleIndexes,
  onSelectBottle,
  interactionDisabled = false,
  onClearingPourStart,
  onClearingPourComplete,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const nextPresentationId = useRef(0);
  const [pourPresentations, setPourPresentations] = useState<
    readonly PourPresentation[]
  >([]);

  const finishPresentation = useCallback((presentationId: number) => {
    setPourPresentations((current) =>
      current.filter((presentation) => presentation.id !== presentationId),
    );
  }, []);

  const finishPresentationsForBottle = (bottleIndex: number) => {
    setPourPresentations((current) =>
      current.filter(
        (presentation) =>
          presentation.sourceBottleIndex !== bottleIndex &&
          presentation.destinationBottleIndex !== bottleIndex,
      ),
    );
  };

  const selectBottle = (bottleIndex: number) => {
    if (interactionDisabled) {
      return;
    }

    finishPresentationsForBottle(bottleIndex);

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

    const move = {
      sourceBottleIndex,
      destinationBottleIndex: bottleIndex,
    };
    const nextState = applyWaterSortMove(state, move);
    const sourceBottle = bottleRefs.current[sourceBottleIndex];
    const destinationBottle = bottleRefs.current[bottleIndex];
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (
      !nextState ||
      !sourceBottle ||
      !destinationBottle ||
      prefersReducedMotion
    ) {
      onSelectBottle(bottleIndex);
      return;
    }

    const sourceBefore = state[sourceBottleIndex] ?? [];
    const pourColorIndex = sourceBefore[sourceBefore.length - 1];
    if (pourColorIndex === undefined) {
      onSelectBottle(bottleIndex);
      return;
    }

    const presentation: PourPresentation = {
      id: nextPresentationId.current,
      sourceBottleIndex,
      destinationBottleIndex: bottleIndex,
      sourceBefore,
      sourceAfter: nextState[sourceBottleIndex] ?? [],
      destinationBefore: state[bottleIndex] ?? [],
      destinationAfter: nextState[bottleIndex] ?? [],
      pourColorIndex,
      isClearingMove: isWaterSortCleared(nextState),
      sourceRect: captureRect(sourceBottle),
      destinationRect: captureRect(destinationBottle),
    };
    nextPresentationId.current += 1;

    setPourPresentations((current) => [
      ...current.filter(
        (activePresentation) =>
          activePresentation.sourceBottleIndex !== sourceBottleIndex &&
          activePresentation.destinationBottleIndex !== sourceBottleIndex &&
          activePresentation.sourceBottleIndex !== bottleIndex &&
          activePresentation.destinationBottleIndex !== bottleIndex,
      ),
      presentation,
    ]);
    if (presentation.isClearingMove) {
      onClearingPourStart?.();
    }
    onSelectBottle(bottleIndex);
  };

  const animatedBottleIndexes = new Set(
    pourPresentations.flatMap((presentation) => [
      presentation.sourceBottleIndex,
      presentation.destinationBottleIndex,
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
              className="group relative aspect-[0.36] w-full origin-top cursor-pointer touch-manipulation rounded-b-[1.45rem] transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              data-selected={isSource || undefined}
              disabled={interactionDisabled}
              style={{ visibility: isAnimated ? "hidden" : undefined }}
            >
              <BottleVisual bottle={bottle} />
            </button>
          );
        })}
      </fieldset>

      {pourPresentations.map((presentation) => (
        <PourPresentationLayer
          key={presentation.id}
          presentation={presentation}
          onFinish={finishPresentation}
          onClearingPourComplete={onClearingPourComplete}
        />
      ))}
    </>
  );
}

function PourPresentationLayer({
  presentation,
  onFinish,
  onClearingPourComplete,
}: {
  presentation: PourPresentation;
  onFinish: (presentationId: number) => void;
  onClearingPourComplete?: () => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const sourceTransferRef = useRef<HTMLSpanElement>(null);
  const destinationTransferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    const streamElement = streamRef.current;
    if (!sourceElement?.animate) {
      onFinish(presentation.id);
      if (presentation.isClearingMove) {
        onClearingPourComplete?.();
      }
      return;
    }

    const { sourceRect, destinationRect } = presentation;
    const deltaX = destinationRect.left - sourceRect.left;
    const deltaY = destinationRect.top - sourceRect.top;
    const hoverY = deltaY - sourceRect.height * 0.55;
    const direction = deltaX >= 0 ? 1 : -1;
    const sourceTransferElement = sourceTransferRef.current;
    const destinationTransferElement = destinationTransferRef.current;
    let active = true;

    const sourceAnimation = sourceElement.animate(
      [
        {
          transform: "translate(0, 0) rotate(0deg)",
          offset: 0,
          easing: "ease-out",
        },
        {
          transform: "translate(0, -4px) rotate(0deg)",
          offset: 0.06,
          easing: "cubic-bezier(.22,.61,.36,1)",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
          offset: 0.2,
          easing: "ease-in-out",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 68}deg)`,
          offset: 0.32,
          easing: "ease-out",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 68}deg)`,
          offset: 0.76,
          easing: "ease-in",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
          offset: 0.86,
          easing: "cubic-bezier(.22,.61,.36,1)",
        },
        { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
      ],
      {
        duration: pourAnimationDurationMs,
        easing: "linear",
      },
    );

    const streamAnimation = streamElement?.animate?.(
      [
        { opacity: 0, transform: "scaleY(0.15)", offset: 0 },
        { opacity: 0, transform: "scaleY(0.15)", offset: 0.32 },
        {
          opacity: 0.9,
          transform: "scaleY(1)",
          offset: pourTransferStartOffset,
        },
        { opacity: 0.9, transform: "scaleY(1)", offset: 0.7 },
        { opacity: 0, transform: "scaleY(0.35)", offset: 0.77 },
        { opacity: 0, transform: "scaleY(0.15)", offset: 1 },
      ],
      { duration: pourAnimationDurationMs, easing: "linear" },
    );

    const sourceTransferAnimation = sourceTransferElement?.animate?.(
      [
        { transform: "scaleY(1)", offset: 0 },
        { transform: "scaleY(1)", offset: pourTransferStartOffset },
        { transform: "scaleY(0)", offset: pourTransferEndOffset },
        { transform: "scaleY(0)", offset: 1 },
      ],
      { duration: pourAnimationDurationMs, easing: "linear", fill: "forwards" },
    );
    const destinationTransferAnimation = destinationTransferElement?.animate?.(
      [
        { transform: "scaleY(0)", offset: 0 },
        { transform: "scaleY(0)", offset: pourTransferStartOffset },
        { transform: "scaleY(1)", offset: pourTransferEndOffset },
        { transform: "scaleY(1)", offset: 1 },
      ],
      { duration: pourAnimationDurationMs, easing: "linear", fill: "forwards" },
    );

    void sourceAnimation.finished.then(
      () => {
        if (!active) {
          return;
        }
        onFinish(presentation.id);
        if (presentation.isClearingMove) {
          onClearingPourComplete?.();
        }
      },
      () => undefined,
    );

    return () => {
      active = false;
      sourceAnimation.cancel();
      streamAnimation?.cancel();
      sourceTransferAnimation?.cancel();
      destinationTransferAnimation?.cancel();
    };
  }, [onClearingPourComplete, onFinish, presentation]);

  return createPortal(
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="group pointer-events-none fixed aspect-[0.36] origin-top rounded-b-[1.45rem] will-change-transform"
        style={getOverlayStyle(presentation.sourceRect, sourcePourLayerZIndex)}
      >
        <BottleVisual
          bottle={presentation.sourceAfter}
          transfer={{
            colorIndex: presentation.pourColorIndex,
            startSlot: presentation.sourceAfter.length,
            slotCount:
              presentation.sourceBefore.length -
              presentation.sourceAfter.length,
            elementRef: sourceTransferRef,
            initialScaleY: 1,
          }}
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top rounded-full opacity-0 will-change-transform"
        style={getPourStreamStyle(presentation)}
      />
      <div
        ref={destinationRef}
        aria-hidden="true"
        className="group pointer-events-none fixed aspect-[0.36] rounded-b-[1.45rem]"
        style={getOverlayStyle(
          presentation.destinationRect,
          destinationPourLayerZIndex,
        )}
      >
        <BottleVisual
          bottle={presentation.destinationBefore}
          transfer={{
            colorIndex: presentation.pourColorIndex,
            startSlot: presentation.destinationBefore.length,
            slotCount:
              presentation.destinationAfter.length -
              presentation.destinationBefore.length,
            elementRef: destinationTransferRef,
            initialScaleY: 0,
          }}
        />
      </div>
    </>,
    document.body,
  );
}

type TransferLiquid = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: RefObject<HTMLSpanElement | null>;
  initialScaleY: number;
};

function BottleVisual({
  bottle,
  transfer,
}: {
  bottle: WaterSortBottle;
  transfer?: TransferLiquid;
}) {
  return (
    <>
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
        {transfer ? (
          <span
            ref={transfer.elementRef}
            className="absolute inset-x-0 origin-bottom will-change-transform"
            style={{
              bottom: `${transfer.startSlot * 25}%`,
              height: `${transfer.slotCount * 25}%`,
              backgroundColor: getColorView(transfer.colorIndex).color,
              transform: `scaleY(${transfer.initialScaleY})`,
            }}
          />
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-2 rounded-b-[1.45rem] border-[3px] border-t-0 border-slate-400/55 shadow-[inset_0_-2px_5px_rgba(15,23,42,0.08),0_5px_12px_rgba(15,23,42,0.06)] transition-[border-color,filter] duration-150 group-data-[selected=true]:border-slate-500 group-data-[selected=true]:drop-shadow-md"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-[3px] w-[calc(100%-2px)] -translate-x-1/2 rounded-full bg-slate-400/55"
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

function captureRect(element: HTMLElement): BottleRect {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getOverlayStyle(rect: BottleRect, zIndex: number) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex,
  };
}

function getPourStreamStyle(presentation: PourPresentation) {
  const { sourceRect, destinationRect } = presentation;
  const streamTop = destinationRect.top - sourceRect.height * 0.55;
  const streamHeight = destinationRect.top - streamTop + 6;
  const color = getColorView(presentation.pourColorIndex).color;

  return {
    left: `${destinationRect.left + destinationRect.width / 2 - 2}px`,
    top: `${streamTop + 3}px`,
    width: "4px",
    height: `${streamHeight}px`,
    backgroundColor: color,
    boxShadow: `0 0 5px ${color}66`,
    zIndex: streamPourLayerZIndex,
  };
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
