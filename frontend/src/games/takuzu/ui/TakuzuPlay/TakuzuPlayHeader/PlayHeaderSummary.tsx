import {
  getTakuzuDifficultyLabel,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { formatTakuzuElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";
import { MetricSeparator } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  difficulty: TakuzuDifficulty;
  elapsedMs: number;
};

export function PlayHeaderSummary({
  difficulty,
  elapsedMs,
}: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-play-context">バイナリパズル</h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
        <span className="whitespace-nowrap">
          {getTakuzuDifficultyLabel(difficulty)}
        </span>
        <MetricSeparator />
        <PlayMetric label="時間" value={formatTakuzuElapsedTime(elapsedMs)} />
      </div>
    </div>
  );
}
