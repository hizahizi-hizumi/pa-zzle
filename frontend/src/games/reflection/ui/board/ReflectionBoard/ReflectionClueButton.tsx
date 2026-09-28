import { useCallback } from "react";

import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { getReflectionClueGridPosition } from "@/games/reflection/ui/board/board-geometry";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import { formatReflectionEntry } from "@/games/reflection/ui/format-entry";
import { reflectionOutcomeLabels } from "@/games/reflection/ui/outcome-label";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionClueButtonProps = {
  size: number;
  entry: ReflectionEntry;
  clue: ReflectionClue;
  /** この位置の光路を表示している。 */
  selected: boolean;
  /** 盤面が揃い、全光路を表示している。 */
  lit: boolean;
  disabled: boolean;
  focusable: boolean;
  focusKey: string;
  onElementChange: (key: string, element: HTMLButtonElement | null) => void;
  onTap: (entry: ReflectionEntry) => void;
  onFocus: (key: string) => void;
};

export function ReflectionClueButton({
  size,
  entry,
  clue,
  selected,
  lit,
  disabled,
  focusable,
  focusKey,
  onElementChange,
  onTap,
  onFocus,
}: ReflectionClueButtonProps) {
  const { row, column } = getReflectionClueGridPosition(size, entry);
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(focusKey, element),
    [focusKey, onElementChange],
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`${formatReflectionEntry(entry)} ${reflectionOutcomeLabels[clue.outcome]} ${clue.distance}マス`}
      aria-pressed={selected}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onTap(entry)}
      onFocus={() => onFocus(focusKey)}
      style={{ gridRow: row, gridColumn: column }}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-[calc(var(--reflection-unit)*0.04)] rounded-sm leading-none text-foreground outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70 disabled:cursor-default enabled:hover:bg-accent/50 enabled:active:bg-accent",
        selected && reflectionToneClassNames.laserSurface,
        (selected || lit) && reflectionToneClassNames.laserLabel,
      )}
    >
      <span className="font-semibold tabular-nums text-[length:clamp(0.8125rem,calc(var(--reflection-unit)*0.4),1.375rem)]">
        {clue.distance}
      </span>
      <span
        className={cn(
          "flex",
          selected || lit
            ? reflectionToneClassNames.laserText
            : "text-muted-foreground",
        )}
      >
        <ReflectionOutcomeMark outcome={clue.outcome} size="clue" />
      </span>
    </button>
  );
}
