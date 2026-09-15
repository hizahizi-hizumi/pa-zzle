export type WaterSortLayerView = {
  id: string;
  label: string;
  symbol: string;
  color: string;
};

export type WaterSortBottleView = {
  id: string;
  label: string;
  layers: readonly WaterSortLayerView[];
};

type WaterSortBoardProps = {
  bottles: readonly WaterSortBottleView[];
  sourceBottleId: string | null;
  targetBottleId: string | null;
  onSelectBottle: (bottleId: string) => void;
};

export function WaterSortBoard({
  bottles,
  sourceBottleId,
  targetBottleId,
  onSelectBottle,
}: WaterSortBoardProps) {
  return (
    <fieldset
      className="flex min-h-48 flex-wrap items-end justify-center gap-x-4 gap-y-8 rounded-lg border bg-muted/20 p-4 sm:p-6"
      aria-label="カラーウォーターソート盤面"
    >
      {bottles.length === 0 && (
        <p className="self-center text-sm text-muted-foreground">
          盤面データを接続すると、ここにボトルが表示されます。
        </p>
      )}
      {bottles.map((bottle) => {
        const selection =
          bottle.id === sourceBottleId
            ? "source"
            : bottle.id === targetBottleId
              ? "target"
              : null;
        const contents =
          bottle.layers.length === 0
            ? "空"
            : bottle.layers.map((layer) => layer.label).join("、");

        return (
          <div key={bottle.id} className="flex flex-col items-center gap-2">
            <span className="h-5 text-xs font-medium text-muted-foreground">
              {selection === "source" && "注ぎ元"}
              {selection === "target" && "注ぎ先"}
            </span>
            <button
              type="button"
              aria-label={`${bottle.label}: ${contents}`}
              aria-pressed={selection !== null}
              onClick={() => onSelectBottle(bottle.id)}
              className="flex h-36 w-16 flex-col-reverse overflow-hidden rounded-b-3xl border-2 border-t-0 bg-background p-1 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=source]:-translate-y-2 data-[selected=source]:ring-2 data-[selected=source]:ring-ring data-[selected=target]:ring-2 data-[selected=target]:ring-ring"
              data-selected={selection ?? undefined}
            >
              {bottle.layers.map((layer) => (
                <span
                  key={layer.id}
                  className="flex min-h-6 items-center justify-center rounded-sm border border-black/10 text-xs font-bold text-black/80"
                  style={{ backgroundColor: layer.color }}
                  title={layer.label}
                >
                  <span aria-hidden="true">{layer.symbol}</span>
                  <span className="sr-only">{layer.label}</span>
                </span>
              ))}
            </button>
            <span className="text-xs text-muted-foreground">
              {bottle.label}
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}
