import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { cn } from "@/lib/utils";

type NanpureDigitPadProps = {
  notesMode: boolean;
  canEnterDigit: boolean;
  completedDigits: readonly NanpureDigit[];
  cuedDigit?: NanpureDigit | null;
  /** 押させたい数字の印の線を短く濃くして戻す目印。変わるたびに戻し直す。`null` なら戻さない。 */
  cuedDigitRecallId?: number | null;
  spotlitDigits?: readonly NanpureDigit[];
  /** `compact` は、盤面に高さを譲るチュートリアルで使う。 */
  size?: "play" | "compact";
  onInputDigit: (digit: NanpureDigit) => void;
};

export function NanpureDigitPad({
  notesMode,
  canEnterDigit,
  completedDigits,
  cuedDigit = null,
  cuedDigitRecallId = null,
  spotlitDigits = [],
  size = "play",
  onInputDigit,
}: NanpureDigitPadProps) {
  const completedDigitSet = new Set(completedDigits);

  return (
    // 狭い幅でも数字がボタンからはみ出さないよう、数字の大きさをボタンの並びの幅で抑える。
    <fieldset className="grid grid-cols-9 gap-x-1 [container-type:inline-size]">
      <legend className="sr-only">数字入力</legend>
      {NANPURE_DIGITS.map((digit) => {
        const disabled = !canEnterDigit || completedDigitSet.has(digit);
        return (
          <button
            key={digit}
            type="button"
            className={cn(
              "relative min-w-0 rounded-md px-0 font-sans text-[min(clamp(1.5rem,7vw,2.25rem),9cqw)] tabular-nums transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/20",
              notesMode
                ? "font-medium text-violet-400/75 dark:text-violet-400/70"
                : "font-medium text-violet-600 dark:text-violet-300",
              size === "play" ? "h-14" : "h-11",
            )}
            onClick={() => onInputDigit(digit)}
            disabled={disabled}
          >
            {digit}
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
