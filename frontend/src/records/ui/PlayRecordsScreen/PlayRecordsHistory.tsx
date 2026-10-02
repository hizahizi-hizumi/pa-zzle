import type { PersonalBest } from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type PlayRecordsHistoryProps = {
  records: readonly PlayRecord[];
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
  isReplayable: (record: PlayRecord) => boolean;
  onReplay: (record: PlayRecord) => void;
};

export function PlayRecordsHistory({
  records,
  display,
  personalBests,
  isReplayable,
  onReplay,
}: PlayRecordsHistoryProps) {
  return (
    <div>
      <div
        className="grid items-end gap-x-2 border-b-(length:--border-width-normal) pb-2 text-meta text-muted-foreground"
        style={{
          gridTemplateColumns: getPlayRecordGridTemplateColumns(
            display.metrics.length,
          ),
        }}
      >
        <span>日時</span>
        {display.metrics.map((metric) => (
          <span key={metric.id} className="text-right">
            {metric.historyLabel}
          </span>
        ))}
        <span className="sr-only">操作</span>
      </div>
      <ol className="divide-y-(length:--border-width-normal)">
        {records.map((record) => (
          <PlayRecordRow
            key={record.id}
            record={record}
            display={display}
            personalBests={personalBests}
            replayable={isReplayable(record)}
            onReplay={onReplay}
          />
        ))}
      </ol>
    </div>
  );
}
