import type { ChangeEvent } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { PersonalBest } from "@/records/personal-best";
import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import { AbandonedPlayAttemptRow } from "@/records/ui/PlayRecordsScreen/AbandonedPlayAttemptRow";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

/** 履歴一覧の1行。完了したプレイと、離脱したプレイを同じ時系列に並べる。 */
export type PlayHistoryEntry =
  | { kind: "cleared"; occurredAt: number; record: PlayRecord }
  | { kind: "abandoned"; occurredAt: number; attempt: AbandonedPlayAttempt };

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
  personalBests: readonly PersonalBest[];
  isReplayable: (record: PlayRecord) => boolean;
  onReplay: (record: PlayRecord) => void;
  isAttemptReplayable: (attempt: AbandonedPlayAttempt) => boolean;
  onReplayAttempt: (attempt: AbandonedPlayAttempt) => void;
  filter: PlayHistoryFilter;
  /** 完了したプレイが無く、離脱したプレイを常に表示するときは切り替えられない。 */
  filterDisabled: boolean;
  onFilterChange: (filter: PlayHistoryFilter) => void;
};

export function PlayRecordsHistory({
  entries,
  display,
  personalBests,
  isReplayable,
  onReplay,
  isAttemptReplayable,
  onReplayAttempt,
  filter,
  filterDisabled,
  onFilterChange,
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
              key={entry.record.id}
              record={entry.record}
              display={display}
              personalBests={personalBests}
              replayable={isReplayable(entry.record)}
              onReplay={onReplay}
            />
          ) : (
            <AbandonedPlayAttemptRow
              key={`${entry.attempt.gameId}:${entry.attempt.startedAt}`}
              attempt={entry.attempt}
              display={display}
              replayable={isAttemptReplayable(entry.attempt)}
              onReplay={onReplayAttempt}
            />
          ),
        )}
      </ol>
    </div>
  );
}
