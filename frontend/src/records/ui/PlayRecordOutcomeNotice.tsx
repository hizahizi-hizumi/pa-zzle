import { Sparkles, Trophy } from "lucide-react";

import { GameResultSurface } from "@/components/GameResultSurface";
import type { PlayRecordSaveOutcome } from "../save-play-record";
import {
  getPersonalBestMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "./play-record-display";

type PlayRecordOutcomeNoticeProps = {
  outcome: PlayRecordSaveOutcome | null;
  display: PlayRecordDisplayDefinition;
};

function getMetricDirection(
  display: PlayRecordDisplayDefinition,
  metricId: string,
): "higher" | "lower" | null {
  const metric = display.definition.personalBestMetrics.find(
    (personalBestMetric) => personalBestMetric.id === metricId,
  );

  return metric?.direction ?? null;
}

function formatElapsedImprovement(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}秒短縮`;
  }

  return seconds === 0 ? `${minutes}分短縮` : `${minutes}分${seconds}秒短縮`;
}

function getImprovementLabel(
  display: PlayRecordDisplayDefinition,
  metricId: string,
  previousValue: number,
  currentValue: number,
): string {
  const improvementAmount = Math.max(
    0,
    getMetricDirection(display, metricId) === "higher"
      ? currentValue - previousValue
      : previousValue - currentValue,
  );

  switch (metricId) {
    case "play-score":
      return `+${improvementAmount}点`;
    case "elapsed-ms":
      return formatElapsedImprovement(improvementAmount);
    case "mistake-count":
    case "failed-move-count":
      return `${improvementAmount}回減`;
    case "move-delta":
      return `${improvementAmount}手改善`;
    default:
      return "更新";
  }
}

export function PlayRecordOutcomeNotice({
  outcome,
  display,
}: PlayRecordOutcomeNoticeProps) {
  if (
    !outcome ||
    outcome.status === "recorded" ||
    outcome.status === "first-record"
  ) {
    return null;
  }

  if (outcome.status === "failed") {
    return (
      <p
        role="status"
        className="mt-3 rounded-xl border border-dashed px-4 py-2 text-center text-xs text-muted-foreground"
      >
        このプレイの記録を保存できませんでした
      </p>
    );
  }

  return (
    <div className="mt-3">
      <GameResultSurface variant="personalBest" label="自己ベスト更新">
        <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300">
          <Trophy className="size-4" />
          <p className="text-sm font-bold">自己ベスト更新</p>
          <Sparkles className="size-4" />
        </div>
        <dl className="mt-3 divide-y divide-amber-200/80 dark:divide-amber-900/70">
          {outcome.updates.flatMap((update) => {
            const metricDisplay = getPersonalBestMetricDisplay(
              display,
              update.metricId,
            );
            if (!metricDisplay) {
              return [];
            }

            return [
              <div key={update.metricId} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm font-medium text-foreground/85">
                    {metricDisplay.label}
                  </dt>
                  <dd className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    {getImprovementLabel(
                      display,
                      update.metricId,
                      update.previousValue,
                      update.currentValue,
                    )}
                  </dd>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <dd className="justify-self-start font-mono text-xs text-muted-foreground line-through tabular-nums">
                    {metricDisplay.formatValue(update.previousValue)}
                  </dd>
                  <dd className="justify-self-center font-mono text-4xl font-bold tracking-tight text-foreground tabular-nums">
                    {metricDisplay.formatValue(update.currentValue)}
                  </dd>
                  <span aria-hidden="true" />
                </div>
              </div>,
            ];
          })}
        </dl>
      </GameResultSurface>
    </div>
  );
}
