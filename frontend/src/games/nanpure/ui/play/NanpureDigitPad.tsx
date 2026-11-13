import { Lock } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { cn } from "@/lib/utils";

/** マインスイーパーの長押しで旗を置く長さに揃える。 */
const LOCK_LONG_PRESS_MS = 450;

type NanpureDigitPadProps = {
  notesMode: boolean;
  canEnterDigit: boolean;
  completedDigits: readonly NanpureDigit[];
  /** 長押しで固めた数字。固めている間は、選んだマスが無くても数字を押せる。 */
  lockedDigit?: NanpureDigit | null;
  cuedDigit?: NanpureDigit | null;
  /** 押させたい数字の印の線を短く濃くして戻す目印。変わるたびに戻し直す。`null` なら戻さない。 */
  cuedDigitRecallId?: number | null;
  spotlitDigits?: readonly NanpureDigit[];
  /** `compact` は、盤面に高さを譲るチュートリアルで使う。 */
  size?: "play" | "compact";
  onInputDigit: (digit: NanpureDigit) => void;
  /** 渡さなければ、長押しで数字を固めない。 */
  onLockDigit?: (digit: NanpureDigit) => void;
};

export function NanpureDigitPad({
  notesMode,
  canEnterDigit,
  completedDigits,
  lockedDigit = null,
  cuedDigit = null,
  cuedDigitRecallId = null,
  spotlitDigits = [],
  size = "play",
  onInputDigit,
  onLockDigit,
}: NanpureDigitPadProps) {
  const completedDigitSet = new Set(completedDigits);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedByLongPressRef = useRef(false);
  const digitsAvailable = canEnterDigit || lockedDigit !== null;

  function clearLongPressTimer(): void {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    digit: NanpureDigit,
  ): void {
    lockedByLongPressRef.current = false;
    clearLongPressTimer();
    if (!onLockDigit || event.button !== 0) {
      return;
    }
    longPressTimerRef.current = setTimeout(function lockDigit() {
      longPressTimerRef.current = null;
      lockedByLongPressRef.current = true;
      onLockDigit(digit);
    }, LOCK_LONG_PRESS_MS);
  }

  function handleClick(
    event: ReactMouseEvent<HTMLButtonElement>,
    digit: NanpureDigit,
  ): void {
    const followsLongPress = lockedByLongPressRef.current;
    lockedByLongPressRef.current = false;
    // 長押しで固めた後に指を離して届くクリックで、固めを解かない。キーボードのクリック（detail が 0）は長押しの後に届くものではない。
    if (followsLongPress && event.detail !== 0) {
      return;
    }
    if (digitsAvailable) {
      onInputDigit(digit);
    }
  }

  return (
    // 狭い幅でも数字がボタンからはみ出さないよう、数字の大きさをボタンの並びの幅で抑える。
    <fieldset className="grid grid-cols-9 gap-x-1 [container-type:inline-size]">
      <legend className="sr-only">数字入力</legend>
      {NANPURE_DIGITS.map((digit) => {
        const completed = completedDigitSet.has(digit);
        const locked = lockedDigit === digit;
        // 数字を固められるときは、選んだマスが無くても長押しを受けるため押せるままにし、入れられないことは淡い色と aria-disabled で示す。
        const disabled =
          completed || (!digitsAvailable && onLockDigit === undefined);
        const dimmed = completed || !digitsAvailable;
        return (
          <button
            key={digit}
            type="button"
            aria-pressed={onLockDigit ? locked : undefined}
            aria-disabled={(dimmed && !disabled) || undefined}
            className={cn(
              "relative min-w-0 touch-manipulation select-none rounded-md px-0 font-medium font-sans tabular-nums transition-colors [-webkit-touch-callout:none] hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none",
              notesMode
                ? "text-[min(clamp(1.125rem,5vw,1.625rem),6.5cqw)] text-violet-600 dark:text-violet-300"
                : "text-[min(clamp(1.5rem,7vw,2.25rem),9cqw)] text-violet-600 dark:text-violet-300",
              dimmed &&
                "text-muted-foreground/20 dark:text-muted-foreground/20",
              locked &&
                "bg-violet-600 text-white hover:bg-violet-600 dark:bg-violet-500 dark:text-white dark:hover:bg-violet-500",
              locked &&
                notesMode &&
                "bg-violet-400 hover:bg-violet-400 dark:bg-violet-700 dark:hover:bg-violet-700",
              size === "play" ? "h-14" : "h-11",
            )}
            onClick={(event) => handleClick(event, digit)}
            onPointerDown={(event) => handlePointerDown(event, digit)}
            onPointerUp={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onPointerLeave={clearLongPressTimer}
            onContextMenu={(event) => {
              if (onLockDigit) {
                event.preventDefault();
              }
            }}
            disabled={disabled}
          >
            {digit}
            {locked && (
              <Lock
                aria-hidden="true"
                className="absolute top-1 right-1 size-3"
                strokeWidth={2.5}
              />
            )}
            {/* ボタンの形のまま、同じ角丸で覆いから抜く。 */}
            <TutorialSpotlight
              active={spotlitDigits.includes(digit)}
              className="inset-0 rounded-md"
            />
            {cuedDigit === digit && !disabled && (
              <TutorialCue kind="mark" recallId={cuedDigitRecallId} />
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
