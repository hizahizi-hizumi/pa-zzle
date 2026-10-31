import { type PointerEvent, type ReactNode, useRef } from "react";

import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

type IceFloorMazeSwipeAreaProps = {
  /** `true` の間はスワイプを受けない。 */
  disabled: boolean;
  onSwipe: (direction: IceFloorMazeDirection) => void;
  children: ReactNode;
};

/** 指がこの距離だけ動いたら向きを決める。これより小さい揺れやタップでは滑らせない。 */
const SWIPE_THRESHOLD_PX = 18;

/** 指の動きの縦横の大きい方を向きにする。どちらも閾値に届かなければ `null`。 */
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
  /** この指の動きで向きを決め終えたか。1回の指の動きで滑らせるのは1手だけ。 */
  decided: boolean;
};

/**
 * 盤面の外の余白を含むプレイ領域全体でスワイプを受ける。
 * 向きは指が閾値を超えた時点で決め、指を離すまで待たない。ページのスクロールやズームには使わせない。
 */
export function IceFloorMazeSwipeArea({
  disabled,
  onSwipe,
  children,
}: IceFloorMazeSwipeAreaProps) {
  const gesture = useRef<SwipeGesture | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) {
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
    <main
      className="flex min-h-0 flex-1 touch-none select-none items-center justify-center px-3 py-2 sm:px-6"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {children}
    </main>
  );
}

export const _private = { getSwipeDirection };
