import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import { formatPlayedAt } from "@/records/ui/format";
import { ReplayPlayButton } from "@/records/ui/PlayRecordsScreen/ReplayPlayButton";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayAttemptDisplayDefinition } from "@/records/ui/play-attempt-display";

type AbandonedPlayAttemptRowProps = {
  attempt: AbandonedPlayAttempt;
  attemptDisplay: PlayAttemptDisplayDefinition;
  metricCount: number;
  onReplay: (attemptId: string) => void;
};

/** 離脱したプレイは評価を持たず、進み具合も完了したプレイの指標と比べられないので、指標の列には揃えない。 */
export function AbandonedPlayAttemptRow({
  attempt,
  attemptDisplay,
  metricCount,
  onReplay,
}: AbandonedPlayAttemptRowProps) {
  const progress = attemptDisplay.progress.flatMap((item) => {
    const value = attemptDisplay.definition.progress
      .find((candidate) => candidate.id === item.id)
      ?.getValue(attempt);
    return value === null || value === undefined
      ? []
      : [{ ...item, formattedValue: item.formatValue(value) }];
  });

  // 評価の列に離脱したことを示し、残りの指標の列をまとめて進み具合に使う。
  const progressColumnCount = metricCount - 1;
  const abandonedLabel = (
    <span className="text-right text-supporting font-medium">離脱</span>
  );
  const progressList = (
    <dl className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 text-meta">
      {progress.map((item) => (
        <div key={item.id} className="flex items-baseline gap-1">
          <dt>{item.label}</dt>
          <dd className="font-mono font-medium tabular-nums">
            {item.formattedValue}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <li
      className="grid items-center gap-x-2 py-3 text-muted-foreground"
      style={{
        gridTemplateColumns: getPlayRecordGridTemplateColumns(metricCount),
      }}
    >
      <p className="text-meta tabular-nums">
        {formatPlayedAt(attempt.abandonment.abandonedAt)}
      </p>
      {progressColumnCount > 0 ? (
        <>
          {abandonedLabel}
          <div
            className="flex min-w-0 justify-end"
            style={{ gridColumn: `span ${progressColumnCount}` }}
          >
            {progressList}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-3">
          {abandonedLabel}
          {progressList}
        </div>
      )}
      {/* 完了したプレイの行と同じ見た目にするため、行の控えめな文字色を操作には引き継がない。 */}
      <div className="flex justify-end text-foreground">
        <ReplayPlayButton onReplay={() => onReplay(attempt.id)} />
      </div>
    </li>
  );
}
