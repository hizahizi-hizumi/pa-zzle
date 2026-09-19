import { formatElapsedTime } from "@/games/nanpure/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/nanpure/ui/play/NanpurePlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/nanpure/ui/play/NanpurePlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
};

export function PlayHeaderSummary({
  elapsedMs,
  mistakeCount,
  undoCount,
}: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-sm font-semibold tracking-tight">
        ナンプレ
      </h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] leading-none text-muted-foreground">
        <PlayMetric label="ミス" value={String(mistakeCount)} />
        <MetricSeparator />
        <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
        <MetricSeparator />
        <PlayMetric label="待った" value={String(undoCount)} />
      </div>
    </div>
  );
}
