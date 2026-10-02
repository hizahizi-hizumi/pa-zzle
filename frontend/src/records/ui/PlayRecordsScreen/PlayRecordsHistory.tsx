import type { ChangeEvent } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { PersonalBest } from "@/records/personal-best";
import { AbandonedPlayAttemptRow } from "@/records/ui/PlayRecordsScreen/AbandonedPlayAttemptRow";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import type { PlayHistoryEntry } from "@/records/ui/PlayRecordsScreen/play-history-entries";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayAttemptDisplayDefinition } from "@/records/ui/play-attempt-display";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

/**
 * - `cleared`: 完了したプレイだけを並べる。
 * - `all`: 離脱したプレイも混ぜて並べる。
 */
export type PlayHistoryFilter = "cleared" | "all";

function isPlayHistoryFilter(value: string): value is PlayHistoryFilter {
  return value === "cleared" || value === "all";
}

type PlayRecordsHistoryProps = {
  entries: readonly PlayHistoryEntry[];
  display: PlayRecordDisplayDefinition;
  attemptDisplay: PlayAttemptDisplayDefinition;
  personalBests: readonly PersonalBest[];
  filter: PlayHistoryFilter;
  /** 完了したプレイが無く、離脱したプレイを常に表示するときは切り替えられない。 */
  filterDisabled: boolean;
  onFilterChange: (filter: PlayHistoryFilter) => void;
  /** 完了記録または離脱した試行の id で、その問題を再プレイする。 */
  onReplay: (playId: string) => void;
};

export function PlayRecordsHistory({
  entries,
  display,
  attemptDisplay,
  personalBests,
  filter,
  filterDisabled,
  onFilterChange,
  onReplay,
}: PlayRecordsHistoryProps) {
  function handleFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    if (isPlayHistoryFilter(event.target.value)) {
      onFilterChange(event.target.value);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <NativeSelect
          size="sm"
          aria-label="表示するプレイ"
          value={filter}
          disabled={filterDisabled}
          onChange={handleFilterChange}
        >
          <NativeSelectOption value="cleared">クリアのみ</NativeSelectOption>
          <NativeSelectOption value="all">すべて</NativeSelectOption>
        </NativeSelect>
      </div>

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
        {entries.map((entry) =>
          entry.kind === "cleared" ? (
            <PlayRecordRow
              key={entry.key}
              record={entry.record}
              display={display}
              personalBests={personalBests}
              onReplay={onReplay}
            />
          ) : (
            <AbandonedPlayAttemptRow
              key={entry.key}
              attempt={entry.attempt}
              attemptDisplay={attemptDisplay}
              metricCount={display.metrics.length}
              onReplay={onReplay}
            />
          ),
        )}
      </ol>
    </div>
  );
}
