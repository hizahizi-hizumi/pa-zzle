import { formatWaterSortElapsedTime } from "@/games/water-sort/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
};

export function PlayHeaderSummary({
  elapsedMs,
  moveCount,
  undoCount,
}: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-sm font-semibold tracking-tight">
        ウォーターソート
      </h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] leading-none text-muted-foreground">
        <PlayMetric label="手数" value={String(moveCount)} />
        <MetricSeparator />
        <PlayMetric
          label="時間"
          value={formatWaterSortElapsedTime(elapsedMs)}
        />
        <MetricSeparator />
        <PlayMetric label="待った" value={String(undoCount)} />
      </div>
    </div>
  );
}
