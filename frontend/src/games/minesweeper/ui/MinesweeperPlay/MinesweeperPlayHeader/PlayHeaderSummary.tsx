import { formatElapsedTime } from "../../format-elapsed-time";
import { MetricSeparator } from "./PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "./PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  elapsedMs: number;
};

// 4項目が1行に収まらない幅では、盤面の情報（地雷・旗）とプレイの経過（ミス・時間）の2行に分ける。
export function PlayHeaderSummary({
  mineCount,
  flagCount,
  mistakeCount,
  elapsedMs,
}: PlayHeaderSummaryProps) {
  return (
    <div className="@container min-w-0 text-center">
      <h1 className="truncate text-play-context">マインスイーパー</h1>
      <div className="mt-1 flex flex-col items-center text-play-meta text-muted-foreground @[16.5rem]:flex-row @[16.5rem]:justify-center @[16.5rem]:gap-2">
        <div className="flex items-center justify-center gap-2">
          <PlayMetric label="地雷" value={String(mineCount)} />
          <MetricSeparator />
          <PlayMetric label="旗" value={String(flagCount)} />
        </div>
        <span className="hidden @[16.5rem]:inline">
          <MetricSeparator />
        </span>
        <div className="flex items-center justify-center gap-2">
          <PlayMetric label="ミス" value={String(mistakeCount)} />
          <MetricSeparator />
          <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
        </div>
      </div>
    </div>
  );
}
