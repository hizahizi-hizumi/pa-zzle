import {
  getPersonalBestMetricIdsForRecord,
  type PersonalBest,
} from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";
import { formatRecordCompletedAt } from "@/records/ui/format";
import { CopyPlayRecordsButton } from "@/records/ui/PlayRecordsScreen/CopyPlayRecordsButton";
import { ReplayPlayButton } from "@/records/ui/PlayRecordsScreen/ReplayPlayButton";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type PlayRecordRowProps = {
  record: PlayRecord;
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
  onReplay: (recordId: string) => void;
};

export function PlayRecordRow({
  record,
  display,
  personalBests,
  onReplay,
}: PlayRecordRowProps) {
  const bestMetricIds = getPersonalBestMetricIdsForRecord(
    record,
    personalBests,
    display.definition,
  );

  return (
    <li
      className="grid items-center gap-x-2 py-3"
      style={{
        gridTemplateColumns: getPlayRecordGridTemplateColumns(
          display.metrics.length,
        ),
      }}
    >
      <p className="text-meta text-muted-foreground tabular-nums">
        {formatRecordCompletedAt(record.completedAt)}
      </p>
      {display.metrics.map((metric, metricIndex) => {
        const value = getPlayRecordMetricValue(
          record,
          display.definition,
          metric.id,
        );
        const isBest = bestMetricIds.includes(metric.id);
        const formattedValue = value === null ? "—" : metric.formatValue(value);

        return (
          <span
            key={metric.id}
            className={`min-w-0 text-right font-mono tabular-nums ${
              metricIndex === 0 ? "text-supporting" : "text-meta"
            } ${isBest ? "font-bold text-foreground" : "font-medium"}`}
            aria-label={
              isBest && value !== null
                ? `${metric.label} ${formattedValue} 自己ベスト`
                : `${metric.label} ${formattedValue}`
            }
          >
            {formattedValue}
          </span>
        );
      })}
      <div className="flex justify-end gap-1">
        <CopyPlayRecordsButton
          records={[record]}
          label="この記録をJSONでコピー"
        />
        <ReplayPlayButton onReplay={() => onReplay(record.id)} />
      </div>
    </li>
  );
}
