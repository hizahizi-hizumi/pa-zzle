import type { ReactNode } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { useTouchTap } from "@/components/touch-tap";
import type { MagicSquareValueState } from "@/games/magic-square/puzzle/rules";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";
import { cn } from "@/lib/utils";

/** チュートリアルで次に押す数に付ける指の印。`recallId` は `TutorialCue` と同じ。 */
export type MagicSquareValueCue = {
  value: number;
  recallId: number | null;
};

type MagicSquareNumberPadProps = {
  size: number;
  /** 1 から n² までの数の状態。並びは数の小さい順。 */
  valueStates: readonly MagicSquareValueState[];
  interactionDisabled: boolean;
  onEnterValue: (value: number) => void;
  /** 最後の数のすぐ後ろの枠に置く操作。 */
  trailingAction?: ReactNode;
  /** チュートリアルだけが渡す。渡さなければ本番と同じに描く。 */
  cue?: MagicSquareValueCue | null;
};

/**
 * 盤面の一辺ごとの列の数。数は問題が変わっても同じ位置に並べる。4×4 は盤面と同じ4列にすると2つ目の盤面に見えるので8列にし、
 * 5×5 と 6×6 は最後の行に枠が余り、そこに待ったが入る列の数にする。
 */
const columnCountBySize: Readonly<Record<number, number>> = {
  4: 8,
  5: 7,
  6: 8,
};

function getColumnCount(size: number): number {
  return columnCountBySize[size] ?? size;
}

/**
 * 数の欄。1 から n² までを小さい順に、使った数（最初から置いてある数を含む）も同じ位置で薄くして並べる。
 * 選んだマスに置いてある数は縁取りし、押すとそのマスから外す。
 */
export function MagicSquareNumberPad({
  size,
  valueStates,
  interactionDisabled,
  onEnterValue,
  trailingAction,
  cue = null,
}: MagicSquareNumberPadProps) {
  const { getTapHandlers } = useTouchTap();

  return (
    <div
      role="group"
      aria-label="数の欄"
      className="grid touch-manipulation select-none items-center gap-1 font-sans [-webkit-touch-callout:none]"
      style={{
        gridTemplateColumns: `repeat(${getColumnCount(size)}, minmax(0, 1fr))`,
      }}
    >
      {valueStates.map((state, index) => {
        const value = index + 1;
        const used = state === "used";
        const selected = state === "selected";
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            disabled={used}
            className={cn(
              "relative flex h-11 items-center justify-center rounded-md text-lg font-semibold tabular-nums leading-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              used && "opacity-30",
            )}
            style={{
              backgroundColor: magicSquareTone.tablet,
              color: magicSquareTone.placedInk,
              boxShadow: selected
                ? `inset 0 0 0 3px ${magicSquareTone.selection}`
                : `inset 0 0 0 1px ${magicSquareTone.tabletEdge}`,
            }}
            {...getTapHandlers(() => {
              if (!interactionDisabled) {
                onEnterValue(value);
              }
            })}
          >
            {value}
            {cue?.value === value && (
              <TutorialCue kind="pointer" recallId={cue.recallId} />
            )}
          </button>
        );
      })}
      {trailingAction && (
        <div className="flex items-center justify-center">{trailingAction}</div>
      )}
    </div>
  );
}
