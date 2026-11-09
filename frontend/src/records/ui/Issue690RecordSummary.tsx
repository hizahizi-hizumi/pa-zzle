import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "@/records/ui/play-record-display";

export type Issue690RecordSummaryProps = {
  outcome: PlayRecordSaveOutcome | null | undefined;
  display: PlayRecordDisplayDefinition | undefined;
};

export function Issue690RecordSummary({
  outcome,
  display,
}: Issue690RecordSummaryProps) {
  if (outcome?.status === "updated" && display) {
    return (
      <section className="i690-record-note is-best" aria-label="自己ベスト更新">
        <strong className="i690-record-title">自己ベスト更新</strong>
        <dl
          className={`i690-record-updates${outcome.updates.length > 2 ? " is-multiple" : ""}`}
        >
          {outcome.updates.flatMap((update) => {
            const metric = getPlayRecordMetricDisplay(display, update.metricId);
            if (!metric) return [];
            const direction = display.definition.personalBestMetrics.find(
              (value) => value.id === update.metricId,
            )?.direction;
            const improvement = Math.max(
              0,
              direction === "higher"
                ? update.currentValue - update.previousValue
                : update.previousValue - update.currentValue,
            );
            return [
              <div key={update.metricId} className="i690-record-update">
                <dt>{metric.label}</dt>
                <dd className="i690-record-values">
                  <span>{metric.formatValue(update.previousValue)}</span>
                  <span aria-hidden="true">→</span>
                  <b>{metric.formatValue(update.currentValue)}</b>
                </dd>
                <span className="i690-record-improvement">
                  {metric.formatImprovement(improvement)}
                </span>
                <div className="i690-race-tracks" aria-hidden="true">
                  <span className="i690-race-previous" />
                  <span className="i690-race-current" />
                </div>
              </div>,
            ];
          })}
        </dl>
      </section>
    );
  }

  if (
    !outcome ||
    (outcome.status !== "first-record" && outcome.status !== "failed")
  ) {
    return null;
  }

  const content =
    outcome.status === "first-record"
      ? ["はじめての記録", "今回の結果を記録しました"]
      : ["記録を保存できませんでした", "今回の結果は保存されていません"];

  return (
    <section
      className={`i690-record-note ${outcome.status === "failed" ? "is-failed" : "is-first"}`}
      aria-label="記録通知"
    >
      <strong className="i690-record-title">{content[0]}</strong>
      <small className="i690-record-detail">{content[1]}</small>
    </section>
  );
}
