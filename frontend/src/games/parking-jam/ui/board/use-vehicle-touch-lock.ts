import { type RefObject, useEffect } from "react";

/** 指で触れてスクロールを止める物。スワイプが始まる車と、車の両端の矢印。 */
const LOCKED_TARGET_SELECTOR =
  ".parking-jam-car, .parking-jam-direction-control";

/**
 * 盤面の上で、車か矢印に指を置いて始めた動きでだけスクロールを止め、ほかの所から始めた動きでは送れるようにする。
 * SVG の中の要素（車の `g`）に付けた `touch-action` は Chromium がスクロールの判定に使わなかったので、
 * 盤面に置いた受け手で、指の動きの既定の働きを取り消す。
 * 押す操作（矢印を押す）は指を動かさないので、止めても押せる。マウスとペンは指の動きを出さないので、変わらない。
 */
export function useVehicleTouchLock(
  boardRef: RefObject<SVGSVGElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const board = boardRef.current;
    if (!enabled || board === null) {
      return;
    }
    let locked = false;
    function handleTouchStart(event: TouchEvent): void {
      locked =
        event.touches.length === 1 &&
        event.target instanceof Element &&
        event.target.closest(LOCKED_TARGET_SELECTOR) !== null;
    }
    function handleTouchMove(event: TouchEvent): void {
      if (locked && event.cancelable) {
        event.preventDefault();
      }
    }
    board.addEventListener("touchstart", handleTouchStart, { passive: true });
    // 既定の働きを取り消すので、受け手を passive にしない。
    board.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      board.removeEventListener("touchstart", handleTouchStart);
      board.removeEventListener("touchmove", handleTouchMove);
    };
  }, [boardRef, enabled]);
}
