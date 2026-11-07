import { Sparkles, Trophy } from "lucide-react";
import { useEffect, useRef } from "react";

import { GameResultSurface } from "@/components/GameResultSurface";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import type { PersonalBestUpdate } from "@/records/personal-best";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "@/records/ui/play-record-display";

type PlayRecordOutcomeNoticeProps = {
  outcome: PlayRecordSaveOutcome | null;
  display: PlayRecordDisplayDefinition;
};

function getImprovementAmount(
  display: PlayRecordDisplayDefinition,
  { metricId, previousValue, currentValue }: PersonalBestUpdate,
): number {
  const metric = display.definition.personalBestMetrics.find(
    (personalBestMetric) => personalBestMetric.id === metricId,
  );
  const difference =
    metric?.direction === "higher"
      ? currentValue - previousValue
      : previousValue - currentValue;
  return Math.max(0, difference);
}

const BEST_REVEAL_MS = 520;
const BEST_REVEAL_DELAY_MS = 220;
const bestRevealKeyframes: Keyframe[] = [
  { transform: "translateY(8px) scale(0.98)", opacity: 0 },
  { transform: "translateY(0) scale(1)", opacity: 1 },
];

export function PlayRecordOutcomeNotice({
  outcome,
  display,
}: PlayRecordOutcomeNoticeProps) {
  const noticeRef = useRef<HTMLDivElement>(null);
  const updated = outcome?.status === "updated";

  useEffect(() => {
    if (!updated || prefersReducedMotion()) {
      return;
    }

    const animation = noticeRef.current?.animate?.(bestRevealKeyframes, {
      duration: BEST_REVEAL_MS,
      delay: BEST_REVEAL_DELAY_MS,
      easing: MOTION_EASING.celebrate,
      fill: "backwards",
    });
    return () => animation?.cancel();
  }, [updated]);

  if (
    !outcome ||
    outcome.status === "recorded" ||
    outcome.status === "first-record"
  ) {
    return null;
  }

  if (outcome.status === "failed") {
    return (
      <div className="mt-3">
        <Alert>
          <AlertDescription>
            このプレイの記録を保存できませんでした
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={noticeRef} className="mt-2">
      <GameResultSurface variant="personalBest" label="自己ベスト更新">
        <div className="flex items-center justify-center gap-2 text-violet-700 dark:text-violet-300">
          <Trophy className="size-6 shrink-0" aria-hidden="true" />
          <p className="text-heading font-bold">自己ベスト更新</p>
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        </div>
        <dl className="mt-2 divide-y-(length:--border-width-normal) divide-violet-200/80 dark:divide-violet-900/70">
          {outcome.updates.flatMap((update) => {
            const metricDisplay = getPlayRecordMetricDisplay(
              display,
              update.metricId,
            );
            if (!metricDisplay) {
              return [];
            }
            return [
              <div
                key={update.metricId}
                className="flex min-w-0 items-center gap-2 py-1 first:pt-1 last:pb-0"
              >
                <dt className="min-w-0 flex-1 text-meta font-medium text-foreground/85">
                  {metricDisplay.label}
                </dt>
                <dd className="shrink-0 font-ui text-meta text-muted-foreground line-through tabular-nums">
                  {metricDisplay.formatValue(update.previousValue)}
                </dd>
                <dd className="shrink-0 font-ui text-body font-bold tabular-nums text-foreground">
                  {metricDisplay.formatValue(update.currentValue)}
                </dd>
                <dd className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-meta font-bold tabular-nums text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
                  {metricDisplay.formatImprovement(
                    getImprovementAmount(display, update),
                  )}
                </dd>
              </div>,
            ];
          })}
        </dl>
      </GameResultSurface>
    </div>
  );
}
