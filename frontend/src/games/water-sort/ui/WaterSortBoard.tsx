import type { WaterSortState } from "@/games/water-sort/game/state";

const waterSortColors = [
  { label: "赤", symbol: "赤", color: "#f87171" },
  { label: "青", symbol: "青", color: "#60a5fa" },
  { label: "緑", symbol: "緑", color: "#4ade80" },
  { label: "黄", symbol: "黄", color: "#facc15" },
  { label: "紫", symbol: "紫", color: "#c084fc" },
  { label: "橙", symbol: "橙", color: "#fb923c" },
  { label: "水", symbol: "水", color: "#22d3ee" },
  { label: "桃", symbol: "桃", color: "#f472b6" },
] as const;

const bottleSlots = [0, 1, 2, 3] as const;

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  onSelectBottle: (bottleIndex: number) => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  selectableBottleIndexes,
  onSelectBottle,
}: WaterSortBoardProps) {
  return (
    <fieldset
      className="flex min-h-48 flex-wrap items-end justify-center gap-x-3 gap-y-6 rounded-lg border bg-muted/20 p-3 sm:gap-x-4 sm:gap-y-8 sm:p-6"
      aria-label="カラーウォーターソート盤面"
    >
      {state.map((bottle, bottleIndex) => {
        const bottleLabel = `ボトル ${bottleIndex + 1}`;
        const contents =
          bottle.length === 0
            ? "空"
            : bottle
                .map((colorIndex) => getColorView(colorIndex).label)
                .join("、");
        const isSource = bottleIndex === sourceBottleIndex;
        const isSelectable = selectableBottleIndexes.has(bottleIndex);

        return (
          <div
            key={bottleLabel}
            className="flex flex-col items-center gap-1.5 sm:gap-2"
          >
            <span className="h-5 text-xs font-medium text-muted-foreground">
              {isSource && "注ぎ元"}
            </span>
            <button
              type="button"
              aria-label={`${bottleLabel}: ${contents}`}
              aria-pressed={isSource}
              disabled={!isSelectable}
              onClick={() => onSelectBottle(bottleIndex)}
              className="flex h-32 w-14 flex-col-reverse overflow-hidden rounded-b-3xl border-2 border-t-0 bg-background p-1 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 data-[selected=true]:-translate-y-2 data-[selected=true]:ring-2 data-[selected=true]:ring-ring sm:h-36 sm:w-16"
              data-selected={isSource || undefined}
            >
              {bottleSlots.map((slotIndex) => {
                const colorIndex = bottle[slotIndex];
                if (colorIndex === undefined) {
                  return <span key={`slot-${slotIndex}`} className="min-h-6" />;
                }

                const color = getColorView(colorIndex);
                return (
                  <span
                    key={`slot-${slotIndex}`}
                    className="flex min-h-6 items-center justify-center rounded-sm border border-black/10 text-[10px] font-bold text-black/80 sm:text-xs"
                    style={{ backgroundColor: color.color }}
                    title={color.label}
                  >
                    <span aria-hidden="true">{color.symbol}</span>
                    <span className="sr-only">{color.label}</span>
                  </span>
                );
              })}
            </button>
            <span className="text-xs text-muted-foreground">{bottleLabel}</span>
          </div>
        );
      })}
    </fieldset>
  );
}

function getColorView(colorIndex: number) {
  const color = waterSortColors[colorIndex];
  if (!color) {
    return {
      label: `色 ${colorIndex + 1}`,
      symbol: String(colorIndex + 1),
      color: `hsl(${(colorIndex * 47) % 360} 75% 70%)`,
    };
  }

  return color;
}
