import { formatSlidePuzzleElapsedTime } from "@/games/slide-puzzle/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  elapsedMs: number;
  moveCount: number;
};

export function PlayHeaderSummary({
  elapsedMs,
  moveCount,
}: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-play-context">スライドパズル</h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
        <PlayMetric label="手数" value={String(moveCount)} />
        <MetricSeparator />
        <PlayMetric
          label="時間"
          value={formatSlidePuzzleElapsedTime(elapsedMs)}
        />
      </div>
    </div>
  );
}
