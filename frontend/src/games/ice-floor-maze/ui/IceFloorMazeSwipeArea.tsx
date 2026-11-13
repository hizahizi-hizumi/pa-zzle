import { type PointerEvent, type ReactNode, useRef } from "react";

import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

type IceFloorMazeSwipeAreaProps = {
  disabled: boolean;
  onSwipe: (direction: IceFloorMazeDirection) => void;
  children: ReactNode;
};

/** これより小さい指の揺れやタップでは滑らせない。 */
const SWIPE_THRESHOLD_PX = 18;

function getSwipeDirection(
  deltaX: number,
  deltaY: number,
): IceFloorMazeDirection | null {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD_PX) {
    return null;
  }
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX < 0 ? "left" : "right";
  }
  return deltaY < 0 ? "up" : "down";
}

type SwipeGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  decided: boolean;
};

const TAP_CONTROL_SELECTOR =
  "button, a, input, select, textarea, [role='button']";

function startsOnTapControl(target: EventTarget): boolean {
  return (
    target instanceof Element && target.closest(TAP_CONTROL_SELECTOR) !== null
  );
}

export function IceFloorMazeSwipeArea({
  disabled,
  onSwipe,
  children,
}: IceFloorMazeSwipeAreaProps) {
  const gesture = useRef<SwipeGesture | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (
      disabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      startsOnTapControl(event.target)
    ) {
      return;
    }

    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      decided: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (
      disabled ||
      !current ||
      current.decided ||
      current.pointerId !== event.pointerId
    ) {
      return;
    }

    const direction = getSwipeDirection(
      event.clientX - current.startX,
      event.clientY - current.startY,
    );
    if (!direction) {
      return;
    }

    current.decided = true;
    onSwipe(direction);
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    if (gesture.current?.pointerId === event.pointerId) {
      gesture.current = null;
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 touch-none select-none flex-col"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {children}
    </div>
  );
}

export const _private = { getSwipeDirection };
