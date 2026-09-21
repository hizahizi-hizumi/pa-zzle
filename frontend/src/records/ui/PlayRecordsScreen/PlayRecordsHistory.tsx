import type { PersonalBest } from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

import { PlayRecordRow } from "./PlayRecordRow";
import { getPlayRecordGridTemplateColumns } from "./record-grid";

type PlayRecordsHistoryProps = {
  records: readonly PlayRecord[];
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
  onReplay: (recordId: string) => void;
};

export function PlayRecordsHistory({
  records,
  display,
  personalBests,
  onReplay,
}: PlayRecordsHistoryProps) {
  return (
    <div>
      <div
        className="grid items-end gap-x-2 border-b pb-2 text-meta text-muted-foreground"
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
      <ol className="divide-y">
        {records.map((record) => (
          <PlayRecordRow
            key={record.id}
            record={record}
            display={display}
            personalBests={personalBests}
            onReplay={onReplay}
          />
        ))}
      </ol>
    </div>
  );
}
