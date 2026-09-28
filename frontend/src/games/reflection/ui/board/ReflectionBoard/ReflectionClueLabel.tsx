import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";

type ReflectionClueLabelProps = {
  size: number;
  entry: ReflectionEntry;
  clue: ReflectionClue;
};

const sideLabels = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
} as const satisfies Record<ReflectionEntry["side"], string>;

const outcomeLabels = {
  exit: "退出",
  reflect: "反射",
  absorb: "吸収",
} as const satisfies Record<ReflectionClue["outcome"], string>;

// 仮の結果種別の記号。形はプレイUIの段で複数案を比べて決める。
const outcomeMarks = {
  exit: "→",
  reflect: "↩",
  absorb: "●",
} as const satisfies Record<ReflectionClue["outcome"], string>;

/** 外周1マスを含めた格子上の位置（1始まり）。 */
function getClueGridPosition(
  size: number,
  entry: ReflectionEntry,
): { row: number; column: number } {
  switch (entry.side) {
    case "top":
      return { row: 1, column: entry.index + 2 };
    case "right":
      return { row: entry.index + 2, column: size + 2 };
    case "bottom":
      return { row: size + 2, column: entry.index + 2 };
    case "left":
      return { row: entry.index + 2, column: 1 };
  }
}

function getAccessibleName(
  entry: ReflectionEntry,
  clue: ReflectionClue,
): string {
  const unit = entry.side === "top" || entry.side === "bottom" ? "列" : "行";
  return `${sideLabels[entry.side]}${entry.index + 1}${unit} ${outcomeLabels[clue.outcome]} ${clue.distance}マス`;
}

export function ReflectionClueLabel({
  size,
  entry,
  clue,
}: ReflectionClueLabelProps) {
  const { row, column } = getClueGridPosition(size, entry);
  return (
    <div
      role="img"
      aria-label={getAccessibleName(entry, clue)}
      className="flex min-h-0 min-w-0 flex-col items-center justify-center leading-none"
      style={{ gridRow: row, gridColumn: column }}
    >
      <span className="text-sm font-semibold tabular-nums">
        {clue.distance}
      </span>
      <span
        aria-hidden="true"
        className="text-[0.625rem] text-muted-foreground"
      >
        {outcomeMarks[clue.outcome]}
      </span>
    </div>
  );
}
