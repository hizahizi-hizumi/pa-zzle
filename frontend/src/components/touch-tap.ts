import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
} from "react";

/**
 * タッチで押したあと、同じ押し方から届く click を捨てる時間。iOS Safari がダブルタップとして送る click は指を離した直後に届く。
 */
const CLICK_AFTER_TOUCH_TAP_MS = 700;

export type TapHandlers = {
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
};

/** 押せないボタン。`aria-disabled` のボタンはフォーカスを残したまま押せなくしているので、`disabled` と同じく押さなかったことにする。 */
function isDisabled(element: HTMLElement): boolean {
  return element.matches(':disabled, [aria-disabled="true"]');
}

function isInsideElement(event: ReactPointerEvent<HTMLElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

/**
 * タッチ・ペンで押したボタンを、指を離した位置のボタンとして受ける。
 * iOS Safari は、近くを続けて素早く押すと2回目をダブルタップとして扱い、2回目の click を1回目に押した位置へ送る。
 * click だけで受けると、隣のマスを押しても前に押したマスを押したことになるため、タッチ・ペンは pointerup で受け、
 * 直後に届く click は捨てる。マウスとキーボード（`detail` が 0 の click）は click で受ける。
 * 返す `getTapHandlers` の受け口は同じ記録を共有するので、隣り合うボタンの集まりごとに1つ使う。
 */
export function useTouchTap(): {
  getTapHandlers: (onTap: () => void) => TapHandlers;
} {
  const lastTouchTapAtRef = useRef<number | null>(null);

  return useMemo(
    () => ({
      getTapHandlers(onTap: () => void): TapHandlers {
        return {
          onPointerUp(event) {
            if (event.pointerType === "mouse" || !event.isPrimary) return;
            if (isDisabled(event.currentTarget)) return;
            // 押したまま指を外へずらして離したときは、click と同じく押さなかったことにする。
            if (!isInsideElement(event)) return;
            lastTouchTapAtRef.current = event.timeStamp;
            onTap();
          },
          onClick(event) {
            if (isDisabled(event.currentTarget)) return;
            const lastTouchTapAt = lastTouchTapAtRef.current;
            if (
              event.detail !== 0 &&
              lastTouchTapAt !== null &&
              event.timeStamp - lastTouchTapAt < CLICK_AFTER_TOUCH_TAP_MS
            ) {
              return;
            }
            onTap();
          },
        };
      },
    }),
    [],
  );
}
