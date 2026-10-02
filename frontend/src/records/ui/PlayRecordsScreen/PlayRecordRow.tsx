import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getPersonalBestMetricIdsForRecord,
  type PersonalBest,
} from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";
import { formatRecordCompletedAt } from "@/records/ui/format";
import { CopyPlayRecordsButton } from "@/records/ui/PlayRecordsScreen/CopyPlayRecordsButton";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type PlayRecordRowProps = {
  record: PlayRecord;
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
  replayable: boolean;
  onReplay: (record: PlayRecord) => void;
};

const replayLabel = "同じ問題をプレイ";
const unavailableReplayLabel = "この記録の問題は今は遊べません";

export function PlayRecordRow({
  record,
  display,
  personalBests,
  replayable,
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
        {/* 押せないボタンはポインターを受けないので、押せない理由の title は包む要素に付ける。 */}
        <span title={replayable ? replayLabel : unavailableReplayLabel}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={replayable ? replayLabel : unavailableReplayLabel}
            disabled={!replayable}
            onClick={() => onReplay(record)}
          >
            <PlayIcon />
          </Button>
        </span>
      </div>
    </li>
  );
}
