import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import { formatPlayedAt } from "@/records/ui/format";
import { ReplayPlayButton } from "@/records/ui/PlayRecordsScreen/ReplayPlayButton";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type AbandonedPlayAttemptRowProps = {
  attempt: AbandonedPlayAttempt;
  display: PlayRecordDisplayDefinition;
  replayable: boolean;
  onReplay: (attempt: AbandonedPlayAttempt) => void;
};

/**
 * 離脱したプレイは評価を持たず、進み具合も完了したプレイの指標と比べられないので、
 * 評価の列に離脱したことを示し、残りの指標の列をまとめて進み具合に使う。
 */
export function AbandonedPlayAttemptRow({
  attempt,
  display,
  replayable,
  onReplay,
}: AbandonedPlayAttemptRowProps) {
  const { progress } = attempt.abandonment;
  const metricCount = display.metrics.length;

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
      <span className="text-right text-supporting font-medium">離脱</span>
      <dl
        className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 text-meta"
        style={{ gridColumn: `span ${metricCount - 1}` }}
      >
        {Object.entries(display.progress).map(([id, item]) => {
          const value = progress[id];
          return value === undefined ? null : (
            <div key={id} className="flex items-baseline gap-1">
              <dt>{item.label}</dt>
              <dd className="font-mono font-medium tabular-nums">
                {item.formatValue(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      {/* 完了したプレイの行と同じ見た目にするため、行の控えめな文字色を操作には引き継がない。 */}
      <div className="flex justify-end text-foreground">
        <ReplayPlayButton
          replayable={replayable}
          onReplay={() => onReplay(attempt)}
        />
      </div>
    </li>
  );
}
