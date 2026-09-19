import type { PlayRecordSaveOutcome } from "../save-play-record";
import {
  getPersonalBestMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "./play-record-display";

type PlayRecordOutcomeNoticeProps = {
  outcome: PlayRecordSaveOutcome | null;
  display: PlayRecordDisplayDefinition;
};

export function PlayRecordOutcomeNotice({
  outcome,
  display,
}: PlayRecordOutcomeNoticeProps) {
  if (!outcome || outcome.status === "recorded") {
    return null;
  }

  if (outcome.status === "failed") {
    return (
      <p
        role="status"
        className="mt-5 text-center text-sm text-muted-foreground"
      >
        このプレイの記録を保存できませんでした
      </p>
    );
  }

  if (outcome.status === "first-record") {
    return (
      <section
        aria-label="記録"
        className="mt-5 rounded-xl bg-muted/60 px-4 py-3 text-center"
      >
        <p className="font-semibold">初記録</p>
        <p className="mt-1 text-sm text-muted-foreground">
          この条件で最初のプレイ記録です
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="自己ベスト更新"
      className="mt-5 rounded-xl bg-muted/60 px-4 py-3"
    >
      <p className="text-center font-semibold">自己ベスト更新</p>
      <dl className="mt-3 grid gap-2">
        {outcome.updates.flatMap((update) => {
          const metricDisplay = getPersonalBestMetricDisplay(
            display,
            update.metricId,
          );
          if (!metricDisplay) {
            return [];
          }

          return [
            <div
              key={update.metricId}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <dt className="text-muted-foreground">{metricDisplay.label}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                <span className="text-muted-foreground line-through">
                  {metricDisplay.formatValue(update.previousValue)}
                </span>{" "}
                → {metricDisplay.formatValue(update.currentValue)}
              </dd>
            </div>,
          ];
        })}
      </dl>
    </section>
  );
}
