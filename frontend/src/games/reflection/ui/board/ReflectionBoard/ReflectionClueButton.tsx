import { useCallback } from "react";

import type {
  ReflectionClue,
  ReflectionEntry,
  ReflectionSide,
} from "@/games/reflection/puzzle/laser";
import { getReflectionClueGridPosition } from "@/games/reflection/ui/board/board-geometry";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import { formatReflectionEntry } from "@/games/reflection/ui/format-entry";
import { reflectionOutcomeLabels } from "@/games/reflection/ui/outcome-label";
import {
  reflectionOutcomeToneClassNames,
  reflectionToneClassNames,
} from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionClueButtonProps = {
  size: number;
  entry: ReflectionEntry;
  clue: ReflectionClue;
  /** この位置の光路を表示している。 */
  selected: boolean;
  /** 今の配置での光が、この外周ヒントの行き先・マスの数と一致している。 */
  matched: boolean;
  /** 光路を表示しているとき、今の配置での光の結果（通るマスの数と行き先）。 */
  laserResult: ReflectionClue | null;
  /** 表示中の光が、この外周ヒントの位置から出た（入った位置と違うときだけ）。 */
  laserExit: boolean;
  disabled: boolean;
  focusable: boolean;
  focusKey: string;
  onElementChange: (key: string, element: HTMLButtonElement | null) => void;
  onTap: (entry: ReflectionEntry) => void;
  onFocus: (key: string) => void;
};

/**
 * 今の光の札の位置。上下の辺は盤面の外側へはみ出させ、左右の辺は画面の端で切れないよう外周ヒントの上へ出す。
 * どちらも光路の入口（外周ヒントの盤面側の縁）を隠さない。
 */
const laserBadgePositionClassNames = {
  top: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/3",
  bottom: "top-full left-1/2 -translate-x-1/2 -translate-y-1/3",
  left: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/3",
  right: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/3",
} as const satisfies Record<ReflectionSide, string>;

export function ReflectionClueButton({
  size,
  entry,
  clue,
  selected,
  matched,
  laserResult,
  laserExit,
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
      aria-label={`${formatReflectionEntry(entry)} ${reflectionOutcomeLabels[clue.outcome]} ${clue.distance}マス${matched ? " 一致" : ""}`}
      aria-description={
        laserResult
          ? `今の光 ${reflectionOutcomeLabels[laserResult.outcome]} ${laserResult.distance}マス`
          : undefined
      }
      aria-pressed={selected}
      data-matched={matched}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onTap(entry)}
      onFocus={() => onFocus(focusKey)}
      style={{ gridRow: row, gridColumn: column }}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-[calc(var(--reflection-unit)*0.04)] rounded-sm leading-none text-foreground outline-none focus-visible:z-10 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70 disabled:cursor-default enabled:hover:bg-accent/50 enabled:active:bg-accent",
        selected && reflectionToneClassNames.laserRing,
        laserExit && reflectionToneClassNames.laserExit,
        matched
          ? reflectionToneClassNames.clueMatchSurface
          : selected && reflectionToneClassNames.laserSurface,
      )}
    >
      {/* 一致の切り替えでは地と数字の色だけを瞬時に変え、形・太さ・枠は変えない（寸法も位置も動かさない）。 */}
      <span
        className={cn(
          "font-semibold tabular-nums text-[length:clamp(0.8125rem,calc(var(--reflection-unit)*0.4),1.375rem)]",
          matched
            ? reflectionToneClassNames.clueMatchLabel
            : selected && reflectionToneClassNames.laserLabel,
        )}
      >
        {clue.distance}
      </span>
      <span
        className={cn("flex", reflectionOutcomeToneClassNames[clue.outcome])}
      >
        <ReflectionOutcomeMark outcome={clue.outcome} size="clue" />
      </span>
      {laserResult ? (
        <span
          aria-hidden="true"
          data-laser-badge=""
          className={cn(
            "pointer-events-none absolute z-20 flex items-center gap-[0.125em] rounded-full px-[0.4em] py-[0.1em] font-semibold tabular-nums leading-none shadow-raised text-[length:clamp(0.625rem,calc(var(--reflection-unit)*0.3),0.875rem)]",
            laserBadgePositionClassNames[entry.side],
            reflectionToneClassNames.laserBadge,
          )}
        >
          {laserResult.distance}
          <ReflectionOutcomeMark outcome={laserResult.outcome} size="badge" />
        </span>
      ) : null}
    </button>
  );
}
