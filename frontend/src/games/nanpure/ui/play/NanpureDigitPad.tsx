import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { cn } from "@/lib/utils";

type NanpureDigitPadProps = {
  notesMode: boolean;
  /** 選んだマスに数字を入れられる。偽なら、どの数字も押せない。 */
  canEnterDigit: boolean;
  /** 解の位置に9つそろった数字。押せなくする。 */
  completedDigits: readonly NanpureDigit[];
  /** 押させたい数字。チュートリアルで、次に押す数字に印を付ける。 */
  cuedDigit?: NanpureDigit | null;
  onInputDigit: (digit: NanpureDigit) => void;
};

/** 選んだマスへ入れる1〜9の数字のボタン。 */
export function NanpureDigitPad({
  notesMode,
  canEnterDigit,
  completedDigits,
  cuedDigit = null,
  onInputDigit,
}: NanpureDigitPadProps) {
  const completedDigitSet = new Set(completedDigits);

  return (
    <fieldset className="grid grid-cols-9 gap-x-1">
      <legend className="sr-only">数字入力</legend>
      {NANPURE_DIGITS.map((digit) => {
        const disabled = !canEnterDigit || completedDigitSet.has(digit);
        return (
          <button
            key={digit}
            type="button"
            className={cn(
              "relative h-14 min-w-0 rounded-lg px-0 font-sans text-[clamp(1.5rem,7vw,2.25rem)] tabular-nums transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/20",
              notesMode
                ? "font-medium text-violet-400/75 dark:text-violet-400/70"
                : "font-medium text-violet-600 dark:text-violet-300",
            )}
            onClick={() => onInputDigit(digit)}
            disabled={disabled}
          >
            {digit}
            {cuedDigit === digit && !disabled && (
              <span
                aria-hidden="true"
                data-digit-cue="hint"
                className="pointer-events-none absolute inset-0.5 rounded-md border-[3px] border-sky-600 border-dashed dark:border-sky-400"
              />
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
