import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { formatElapsedTime } from "@/games/reflection/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  relocationCount: number;
  elapsedMs: number;
};

export function PlayHeaderSummary({
  relocationCount,
  elapsedMs,
}: PlayHeaderSummaryProps) {
  return (
    <div className="@container min-w-0 text-center">
      <h1 className="truncate text-play-context">{REFLECTION_DISPLAY_NAME}</h1>
      {/* 置き直しは2桁分の幅を取っておき、10回目で計測値の並びが横へ動かないようにする。 */}
      <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
        <PlayMetric
          label="置き直し"
          value={String(relocationCount)}
          reservedDigits={2}
        />
        <MetricSeparator />
        <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
      </div>
    </div>
  );
}
