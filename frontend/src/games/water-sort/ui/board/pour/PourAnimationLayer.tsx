import { type RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { getWaterColorView } from "../water-bottle/get-water-color-view";
import { WaterBottle } from "../water-bottle/WaterBottle";
import {
  type BottleRect,
  groupPourAnimationsByDestination,
  type PourAnimation,
} from "./pour-animation";

const pourAnimationDurationMs = 1600;
const pourTransferStartOffset = 0.38;
const pourTransferEndOffset = 0.72;
const sourcePourLayerZIndex = 70;
const streamPourLayerZIndex = 69;
const destinationPourLayerZIndex = 65;

type PourAnimationLayerProps = {
  animations: readonly PourAnimation[];
  onFinish: (animationId: number) => void;
};

export function PourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <PourSourceLayer
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <PourDestinationLayer
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

function PourSourceLayer({
  animation,
  onFinish,
}: {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const sourceTransferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    const streamElement = streamRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }

    const { rect: sourceRect } = animation.source;
    const { rect: destinationRect } = animation.destination;
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

    const finishIfActive = () => {
      if (active) {
        onFinish(animation.id);
      }
    };
    void sourceAnimation.finished.then(finishIfActive, finishIfActive);

    return () => {
      active = false;
      sourceAnimation.cancel();
      streamAnimation?.cancel();
      sourceTransferAnimation?.cancel();
    };
  }, [onFinish, animation]);

  return createPortal(
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed aspect-[0.36] origin-top rounded-b-[1.45rem] will-change-transform"
        style={getOverlayStyle(animation.source.rect, sourcePourLayerZIndex)}
      >
        <WaterBottle
          contents={animation.source.after}
          waterOverlay={
            <TransferLiquidView
              transfer={{
                colorIndex: animation.colorIndex,
                startSlot: animation.source.after.length,
                slotCount:
                  animation.source.before.length -
                  animation.source.after.length,
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
        style={getPourStreamStyle(animation)}
      />
    </>,
    document.body,
  );
}

function PourDestinationLayer({
  animations,
}: {
  animations: readonly PourAnimation[];
}) {
  const firstAnimation = animations[0];
  if (!firstAnimation) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed aspect-[0.36] rounded-b-[1.45rem]"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        destinationPourLayerZIndex,
      )}
    >
      <WaterBottle
        contents={firstAnimation.destination.before}
        waterOverlay={animations.map((animation) => (
          <AnimatedDestinationTransfer
            key={animation.id}
            animation={animation}
          />
        ))}
      />
    </div>,
    document.body,
  );
}

function AnimatedDestinationTransfer({
  animation,
}: {
  animation: PourAnimation;
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
        colorIndex: animation.colorIndex,
        startSlot: animation.destination.before.length,
        slotCount:
          animation.destination.after.length -
          animation.destination.before.length,
        elementRef: transferRef,
        initialScaleY: 0,
      }}
    />
  );
}

type TransferLiquid = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: RefObject<HTMLSpanElement | null>;
  initialScaleY: number;
};

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

function getOverlayStyle(rect: BottleRect, zIndex: number) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex,
  };
}

function getPourStreamStyle(animation: PourAnimation) {
  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect } = animation.destination;
  const streamTop = destinationRect.top - sourceRect.height * 0.55;
  const streamHeight = destinationRect.top - streamTop + 6;
  const color = getWaterColorView(animation.colorIndex).color;

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
