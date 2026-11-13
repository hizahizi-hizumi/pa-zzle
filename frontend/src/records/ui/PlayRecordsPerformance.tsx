import { useMemo, useState } from "react";

import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import {
  getPersonalBests,
  listComparableRecords,
} from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { CopyPlayRecordsButton } from "@/records/ui/PlayRecordsPerformance/CopyPlayRecordsButton";
import { PersonalBests } from "@/records/ui/PlayRecordsPerformance/PersonalBests";
import { PlayRecordsTrend } from "@/records/ui/PlayRecordsPerformance/PlayRecordsTrend";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type PlayRecordsPerformanceProps = {
  /** ゲームをまたいだ全記録。比較単位の記録はこの中から選ぶ。 */
  records: readonly PlayRecord[];
  display: PlayRecordDisplayDefinition;
  comparisonKey: string;
};

export function PlayRecordsPerformance({
  records,
  display,
  comparisonKey,
}: PlayRecordsPerformanceProps) {
  const { definition } = display;
  const comparableRecords = useMemo(
    () => listComparableRecords(records, definition, comparisonKey),
    [records, definition, comparisonKey],
  );
  const personalBests = useMemo(
    () => getPersonalBests(comparableRecords, definition),
    [comparableRecords, definition],
  );
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const metricId =
    display.metrics.find(({ id }) => id === selectedMetricId)?.id ??
    display.metrics[0]?.id ??
    "";

  return (
    <div className="grid gap-4">
      <PersonalBests personalBests={personalBests} display={display} />
      {comparableRecords.length > 0 && (
        <>
          <PlayRecordsTrend
            records={comparableRecords}
            display={display}
            metricId={metricId}
            onMetricChange={setSelectedMetricId}
          />
          <div className="flex items-center justify-end gap-1">
            <p className="text-meta text-muted-foreground tabular-nums">
              {comparableRecords.length}件
            </p>
            {internalDiagnosticsAvailable && (
              <CopyPlayRecordsButton
                records={comparableRecords}
                label="記録をJSONでコピー"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
