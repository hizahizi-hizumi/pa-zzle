import { formatElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  correctionCount: number;
  elapsedMs: number;
  undoCount: number;
};

export function PlayHeaderSummary({
  correctionCount,
  elapsedMs,
  undoCount,
}: PlayHeaderSummaryProps) {
  return (
    <div className="@container min-w-0 text-center">
      <h1 className="truncate text-play-context">バイナリパズル</h1>
      {/*
        置き直しと待ったは2桁分の幅を取っておき、10回目で計測値の並びが横へ動かないようにする。
        3項目が1行に収まらない幅では、待ったを2行目に分ける。
      */}
      <div className="mt-1 flex flex-col items-center text-play-meta text-muted-foreground @[14.5rem]:flex-row @[14.5rem]:justify-center @[14.5rem]:gap-2">
        <div className="flex items-center justify-center gap-2">
          <PlayMetric
            label="置き直し"
            value={String(correctionCount)}
            reservedDigits={2}
          />
          <MetricSeparator />
          <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
        </div>
        <span className="hidden @[14.5rem]:inline">
          <MetricSeparator />
        </span>
        <PlayMetric
          label="待った"
          value={String(undoCount)}
          reservedDigits={2}
        />
      </div>
    </div>
  );
}
