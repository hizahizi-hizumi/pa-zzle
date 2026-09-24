import { MetricSeparator } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzlePlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzlePlayHeader/PlayHeaderSummary/PlayMetric";
import { formatFifteenPuzzleElapsedTime } from "@/games/fifteen-puzzle/ui/format-elapsed-time";

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
      <h1 className="truncate text-play-context">15パズル</h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
        <PlayMetric label="手数" value={String(moveCount)} />
        <MetricSeparator />
        <PlayMetric
          label="時間"
          value={formatFifteenPuzzleElapsedTime(elapsedMs)}
        />
      </div>
    </div>
  );
}
