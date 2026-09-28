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
  disabled: boolean;
  focusable: boolean;
  focusKey: string;
  onElementChange: (key: string, element: HTMLButtonElement | null) => void;
  onTap: (entry: ReflectionEntry) => void;
  onFocus: (key: string) => void;
};

/**
 * 今の光の通るマスの数の置き方。目標の数字と並んで1つの数に読まれないよう、目標の数字の横には置かない。
 * - 上下の辺: 盤面の外側の余白へ出す。
 * - 左右の辺: 外側は画面の端、上下は隣の外周ヒントで余白が無いので、結果の形の行を今のマスの数に置き換える。
 *   今の行き先は盤面の光路の線と矢印で分かる。
 */
const outsideLaserCountClassNames = {
  top: "bottom-full pb-[0.1em]",
  bottom: "top-full pt-[0.1em]",
} as const satisfies Partial<Record<ReflectionSide, string>>;

const MARK_ROW_HEIGHT =
  "h-[clamp(0.625rem,calc(var(--reflection-unit)*0.28),1rem)]";

export function ReflectionClueButton({
  size,
  entry,
  clue,
  selected,
  matched,
  laserResult,
  disabled,
  focusable,
  focusKey,
  onElementChange,
  onTap,
  onFocus,
}: ReflectionClueButtonProps) {
  const { row, column } = getReflectionClueGridPosition(size, entry);
  // 一致しているときは緑の地で目標と同じと分かるので、今のマスの数は出さない。
  const laserCount = laserResult && !matched ? laserResult.distance : null;
  const outsideCountClassName =
    entry.side === "top" || entry.side === "bottom"
      ? outsideLaserCountClassNames[entry.side]
      : null;
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
      className="group relative flex min-h-0 min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-[calc(var(--reflection-unit)*0.04)] leading-none text-foreground outline-none focus-visible:z-10 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70 disabled:cursor-default enabled:hover:bg-accent/50 enabled:active:bg-accent"
    >
      {matched ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-[10%]",
            reflectionToneClassNames.clueMatchSurface,
            reflectionToneClassNames.clueMatchSurfaceInteractive,
          )}
        />
      ) : null}
      <span
        className={cn(
          "relative font-semibold tabular-nums text-[length:clamp(0.8125rem,calc(var(--reflection-unit)*0.4),1.375rem)]",
          matched && reflectionToneClassNames.clueMatchLabel,
        )}
      >
        {clue.distance}
      </span>
      {laserCount !== null && outsideCountClassName === null ? (
        <span
          aria-hidden="true"
          data-laser-count=""
          className={cn(
            "relative flex items-center font-semibold tabular-nums text-[length:clamp(0.625rem,calc(var(--reflection-unit)*0.3),1rem)]",
            MARK_ROW_HEIGHT,
            reflectionToneClassNames.laserLabel,
          )}
        >
          {laserCount}
        </span>
      ) : (
        <span
          className={cn(
            "relative flex",
            reflectionOutcomeToneClassNames[clue.outcome],
          )}
        >
          <ReflectionOutcomeMark outcome={clue.outcome} size="clue" />
        </span>
      )}
      {laserCount !== null && outsideCountClassName !== null ? (
        <span
          aria-hidden="true"
          data-laser-count=""
          className={cn(
            "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 font-semibold tabular-nums leading-none text-[length:clamp(0.6875rem,calc(var(--reflection-unit)*0.32),0.9375rem)]",
            outsideCountClassName,
            reflectionToneClassNames.laserLabel,
          )}
        >
          {laserCount}
        </span>
      ) : null}
    </button>
  );
}
