import { lineViolationBarPlacementClassNames } from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

/**
 * - `below-cell`: 2行の例の、違う列のマスの真下（盤面の縁の外）。本番の列の違反の印と同じ置き場所にする。
 * - `legend`: 判定の横の凡例。文字と並べて置く。
 */
export type RowDifferenceBarPlacement = "below-cell" | "legend";

type RowDifferenceBarProps = {
  placement: RowDifferenceBarPlacement;
};

const placementClassNames = {
  "below-cell": cn(
    "pointer-events-none absolute",
    lineViolationBarPlacementClassNames.column.end,
  ),
  legend: "h-0.5 w-5 shrink-0",
} as const satisfies Record<RowDifferenceBarPlacement, string>;

/**
 * 2行の例で見比べる所の短い線。本番の違反の印の線と同じ太さと丸みで、色だけを文字の色にして、違反と見分けられるようにする。
 * 盤面の線と凡例の線を同じ見た目にする。
 */
export function RowDifferenceBar({ placement }: RowDifferenceBarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "rounded-full bg-foreground",
        placementClassNames[placement],
      )}
    />
  );
}
