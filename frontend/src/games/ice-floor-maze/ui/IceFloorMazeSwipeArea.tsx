import { type PointerEvent, type ReactNode, useRef } from "react";

import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { cn } from "@/lib/utils";

/**
 * 指のスワイプを受ける範囲。
 * - `whole`: 領域の全体で受け、領域の全体で画面のスクロールを止める。送らない画面（プレイ画面・チュートリアル）で使う。
 * - `start-targets`: 指のスワイプは、子に置いた `SWIPE_START_TARGET_ATTRIBUTE` の付いた要素の上で始めたときだけ受ける。
 *   その要素がスクロールを止め（`touch-action: none`）、ほかの所では指で画面を送れるようにする。送る画面（遊び方）で使う。
 *   マウスとペンは `whole` と同じく全体で受ける。
 */
type IceFloorMazeSwipeTouchArea = "whole" | "start-targets";

type IceFloorMazeSwipeAreaProps = {
  disabled: boolean;
  onSwipe: (direction: IceFloorMazeDirection) => void;
  touchArea?: IceFloorMazeSwipeTouchArea;
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

/** `start-targets` の領域で、指のスワイプを始められる所に付ける属性。付けた要素は、自分でスクロールを止める。 */
export const SWIPE_START_TARGET_ATTRIBUTE = "data-swipe-start-target";

function startsOnSwipeStartTarget(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${SWIPE_START_TARGET_ATTRIBUTE}]`) !== null
  );
}

export function IceFloorMazeSwipeArea({
  disabled,
  onSwipe,
  touchArea = "whole",
  children,
}: IceFloorMazeSwipeAreaProps) {
  const gesture = useRef<SwipeGesture | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (
      disabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      startsOnTapControl(event.target) ||
      (touchArea === "start-targets" &&
        event.pointerType === "touch" &&
        !startsOnSwipeStartTarget(event.target))
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
      className={cn(
        "flex min-h-0 flex-1 select-none flex-col",
        touchArea === "whole" && "touch-none",
      )}
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
