import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { UndoButton } from "@/components/UndoButton";

/** 押し続けたと見なして連続で戻し始めるまで。短く押した待ったと紛れない長さにする。 */
const REPEAT_DELAY_MS = 380;
/** 押し続けている間に1マス戻す間隔。長い道も数秒で戻せる速さにする。 */
const REPEAT_INTERVAL_MS = 70;

type HitofudePuzzleUndoButtonProps = {
  disabled: boolean;
  onUndo: () => void;
};

/**
 * 待ったは1マスずつ戻すので、押し続けると続けて戻す。
 * 離したときにボタンが受ける1回は、押し続けて戻し始めていれば重ねて戻さない。
 */
export function HitofudePuzzleUndoButton({
  disabled,
  onUndo,
}: HitofudePuzzleUndoButtonProps) {
  const timerRef = useRef<number | null>(null);
  const repeatedRef = useRef(false);
  const onUndoRef = useRef(onUndo);

  useLayoutEffect(() => {
    onUndoRef.current = onUndo;
  }, [onUndo]);

  const stopRepeating = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (disabled) stopRepeating();
  }, [disabled, stopRepeating]);

  useEffect(() => stopRepeating, [stopRepeating]);

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>): void {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    stopRepeating();
    repeatedRef.current = false;
    timerRef.current = window.setTimeout(function startRepeating() {
      repeatedRef.current = true;
      onUndoRef.current();
      timerRef.current = window.setInterval(function repeatUndo() {
        onUndoRef.current();
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  }

  function handleClickCapture(event: MouseEvent<HTMLSpanElement>): void {
    // キーボードのクリック（detail が 0）は、押し続けた指を離して届く1回ではない。
    if (event.detail === 0) {
      repeatedRef.current = false;
    }
  }

  function handleUndo(): void {
    if (repeatedRef.current) {
      repeatedRef.current = false;
      return;
    }
    onUndo();
  }

  return (
    // 押し続けを受けるため、押下と離す操作をこの囲みで受ける。ボタンの外観と、押した1回の受け方は `UndoButton` のまま。
    <span
      className="inline-flex touch-manipulation select-none [-webkit-touch-callout:none]"
      onPointerDown={handlePointerDown}
      onPointerUp={stopRepeating}
      onPointerCancel={stopRepeating}
      onPointerLeave={stopRepeating}
      onClickCapture={handleClickCapture}
      onContextMenu={(event) => event.preventDefault()}
    >
      <UndoButton disabled={disabled} onUndo={handleUndo} />
    </span>
  );
}
