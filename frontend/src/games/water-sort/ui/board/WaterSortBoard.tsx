import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type {
  WaterSortBottle,
  WaterSortState,
} from "@/games/water-sort/game/state";
import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-game";
import { getWaterColorView } from "./water-bottle/get-water-color-view";
import { WaterBottle } from "./water-bottle/WaterBottle";

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
  operationId: number;
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
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled?: boolean;
  onPourComplete?: (operationId: number) => void;
  onClearingPourComplete?: () => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled = false,
  onPourComplete,
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

  useLayoutEffect(() => {
    if (!operation) {
      setPourPresentations([]);
      return;
    }
    if (operation.type === "invalid") {
      animateInvalidBottle(bottleRefs.current[operation.bottleIndex]);
      return;
    }
    if (operation.type !== "poured") return;

    const sourceBottle = bottleRefs.current[operation.sourceBottleIndex];
    const destinationBottle =
      bottleRefs.current[operation.destinationBottleIndex];
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!sourceBottle || !destinationBottle || prefersReducedMotion) {
      onPourComplete?.(operation.id);
      if (operation.isClearingMove) onClearingPourComplete?.();
      return;
    }

    const sourceBefore =
      operation.stateBefore[operation.sourceBottleIndex] ?? [];
    const pourColorIndex = sourceBefore[sourceBefore.length - 1];
    if (pourColorIndex === undefined) {
      onPourComplete?.(operation.id);
      if (operation.isClearingMove) onClearingPourComplete?.();
      return;
    }

    const presentation: PourPresentation = {
      id: nextPresentationId.current++,
      operationId: operation.id,
      sourceBottleIndex: operation.sourceBottleIndex,
      destinationBottleIndex: operation.destinationBottleIndex,
      sourceBefore,
      sourceAfter: operation.stateAfter[operation.sourceBottleIndex] ?? [],
      destinationBefore:
        operation.stateBefore[operation.destinationBottleIndex] ?? [],
      destinationAfter:
        operation.stateAfter[operation.destinationBottleIndex] ?? [],
      pourColorIndex,
      isClearingMove: operation.isClearingMove,
      sourceRect: captureRect(sourceBottle),
      destinationRect: captureRect(destinationBottle),
    };

    setPourPresentations((current) => [
      ...current.filter(
        (activePresentation) =>
          activePresentation.sourceBottleIndex !==
            operation.sourceBottleIndex &&
          activePresentation.destinationBottleIndex !==
            operation.sourceBottleIndex &&
          activePresentation.sourceBottleIndex !==
            operation.destinationBottleIndex,
      ),
      presentation,
    ]);
  }, [operation, onPourComplete, onClearingPourComplete]);

  const selectBottle = (bottleIndex: number) => {
    if (interactionDisabled) return;
    if (sourceBottleIndex === null) {
      setPourPresentations((current) =>
        current.filter(
          (presentation) =>
            presentation.sourceBottleIndex !== bottleIndex &&
            presentation.destinationBottleIndex !== bottleIndex,
        ),
      );
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

      {pourPresentations.map((presentation) => (
        <PourSourceLayer
          key={presentation.id}
          presentation={presentation}
          onFinish={finishPresentation}
          onPourComplete={onPourComplete}
          onClearingPourComplete={onClearingPourComplete}
        />
      ))}
      {groupPresentationsByDestination(pourPresentations).map(
        (presentations) => (
          <PourDestinationLayer
            key={presentations[0]?.destinationBottleIndex}
            presentations={presentations}
          />
        ),
      )}
    </>
  );
}

function PourSourceLayer({
  presentation,
  onFinish,
  onPourComplete,
  onClearingPourComplete,
}: {
  presentation: PourPresentation;
  onFinish: (presentationId: number) => void;
  onPourComplete?: (operationId: number) => void;
  onClearingPourComplete?: () => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const sourceTransferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    const streamElement = streamRef.current;
    if (!sourceElement?.animate) {
      onFinish(presentation.id);
      onPourComplete?.(presentation.operationId);
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
    void sourceAnimation.finished.then(
      () => {
        if (!active) {
          return;
        }
        onFinish(presentation.id);
        onPourComplete?.(presentation.operationId);
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
    };
  }, [onPourComplete, onClearingPourComplete, onFinish, presentation]);

  return createPortal(
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed aspect-[0.36] origin-top rounded-b-[1.45rem] will-change-transform"
        style={getOverlayStyle(presentation.sourceRect, sourcePourLayerZIndex)}
      >
        <WaterBottle
          contents={presentation.sourceAfter}
          waterOverlay={
            <TransferLiquidView
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
          }
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top rounded-full opacity-0 will-change-transform"
        style={getPourStreamStyle(presentation)}
      />
    </>,
    document.body,
  );
}

function PourDestinationLayer({
  presentations,
}: {
  presentations: readonly PourPresentation[];
}) {
  const firstPresentation = presentations[0];
  if (!firstPresentation) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed aspect-[0.36] rounded-b-[1.45rem]"
      style={getOverlayStyle(
        firstPresentation.destinationRect,
        destinationPourLayerZIndex,
      )}
    >
      <WaterBottle
        contents={firstPresentation.destinationBefore}
        waterOverlay={presentations.map((presentation) => (
          <AnimatedDestinationTransfer
            key={presentation.id}
            presentation={presentation}
          />
        ))}
      />
    </div>,
    document.body,
  );
}

function AnimatedDestinationTransfer({
  presentation,
}: {
  presentation: PourPresentation;
}) {
  const transferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const animation = transferRef.current?.animate?.(
      [
        { transform: "scaleY(0)", offset: 0 },
        { transform: "scaleY(0)", offset: pourTransferStartOffset },
        { transform: "scaleY(1)", offset: pourTransferEndOffset },
        { transform: "scaleY(1)", offset: 1 },
      ],
      { duration: pourAnimationDurationMs, easing: "linear", fill: "forwards" },
    );

    return () => animation?.cancel();
  }, []);

  return (
    <TransferLiquidView
      transfer={{
        colorIndex: presentation.pourColorIndex,
        startSlot: presentation.destinationBefore.length,
        slotCount:
          presentation.destinationAfter.length -
          presentation.destinationBefore.length,
        elementRef: transferRef,
        initialScaleY: 0,
      }}
    />
  );
}

function TransferLiquidView({ transfer }: { transfer: TransferLiquid }) {
  return (
    <span
      ref={transfer.elementRef}
      className="absolute inset-x-0 origin-bottom will-change-transform"
      style={{
        bottom: `${transfer.startSlot * 25}%`,
        height: `${transfer.slotCount * 25}%`,
        backgroundColor: getWaterColorView(transfer.colorIndex).color,
        transform: `scaleY(${transfer.initialScaleY})`,
      }}
    />
  );
}

function groupPresentationsByDestination(
  presentations: readonly PourPresentation[],
): readonly (readonly PourPresentation[])[] {
  const groups = new Map<number, PourPresentation[]>();

  for (const presentation of presentations) {
    const current = groups.get(presentation.destinationBottleIndex) ?? [];
    current.push(presentation);
    groups.set(presentation.destinationBottleIndex, current);
  }

  return [...groups.values()];
}

type TransferLiquid = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: RefObject<HTMLSpanElement | null>;
  initialScaleY: number;
};

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
  const color = getWaterColorView(presentation.pourColorIndex).color;

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
