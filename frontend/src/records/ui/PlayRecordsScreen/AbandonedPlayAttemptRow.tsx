import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import { formatRecordCompletedAt } from "@/records/ui/format";
import { ReplayPlayButton } from "@/records/ui/PlayRecordsScreen/ReplayPlayButton";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayAttemptDisplayDefinition } from "@/records/ui/play-attempt-display";

type AbandonedPlayAttemptRowProps = {
  attempt: AbandonedPlayAttempt;
  attemptDisplay: PlayAttemptDisplayDefinition;
  metricCount: number;
  onReplay: (attemptId: string) => void;
};

/**
 * 離脱したプレイの1行。評価が無いため最初の指標（評価）の列に離脱したことを示し、
 * 完了したプレイの指標とは比べられない進み具合は、残りの指標の列をまとめた幅にラベル付きで並べる。
 * 同じ問題の再プレイは完了したプレイの行と同じく選べる。JSONでのコピーは完了記録だけが対象なので置かない。
 */
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

  return (
    <li
      className="grid items-center gap-x-2 py-3 text-muted-foreground"
      style={{
        gridTemplateColumns: getPlayRecordGridTemplateColumns(metricCount),
      }}
    >
      <p className="text-meta tabular-nums">
        {formatRecordCompletedAt(attempt.abandonment.abandonedAt)}
      </p>
      <span className="text-right text-supporting font-medium">離脱</span>
      <dl
        className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 text-meta"
        style={{ gridColumn: `span ${Math.max(metricCount - 1, 1)}` }}
      >
        {progress.map((item) => (
          <div key={item.id} className="flex items-baseline gap-1">
            <dt>{item.label}</dt>
            <dd className="font-mono font-medium tabular-nums">
              {item.formattedValue}
            </dd>
          </div>
        ))}
      </dl>
      {/* 完了したプレイの行と同じ見た目にするため、行の控えめな文字色を操作には引き継がない。 */}
      <div className="flex justify-end text-foreground">
        <ReplayPlayButton onReplay={() => onReplay(attempt.id)} />
      </div>
    </li>
  );
}
