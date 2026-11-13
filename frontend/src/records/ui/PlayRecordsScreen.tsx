import { type ReactNode, useId, useMemo } from "react";

import {
  createPlayCalendar,
  PLAY_CALENDAR_WEEK_COUNT,
  type PlayTimelineEntry,
} from "@/records/play-timeline";
import { EmptyRecords } from "@/records/ui/PlayRecordsScreen/EmptyRecords";
import { PlayCalendar } from "@/records/ui/PlayRecordsScreen/PlayCalendar";
import {
  PLAY_DAY_LIST_BATCH_SIZE,
  PlayDayList,
} from "@/records/ui/PlayRecordsScreen/PlayDayList";
import type { PlayTimelineEntryDescription } from "@/records/ui/play-timeline-entry-description";

type PlayRecordsScreenProps = {
  newestFirstEntries: readonly PlayTimelineEntry[];
  now: number;
  /** 一覧に描く行の分だけ求める。 */
  describeEntry: (entry: PlayTimelineEntry) => PlayTimelineEntryDescription;
  onOpenEntry: (entry: PlayTimelineEntry) => void;
  /** 一覧に新しいものから描くプレイの数。一覧の終わりが近づくと、描き足した数で `onShownEntryCountChange` を呼ぶ。 */
  shownEntryCount: number;
  onShownEntryCountChange: (count: number) => void;
  emptyAction: ReactNode;
  showHeading?: boolean;
};

export const INITIAL_SHOWN_ENTRY_COUNT = PLAY_DAY_LIST_BATCH_SIZE;

export function PlayRecordsScreen({
  newestFirstEntries,
  now,
  describeEntry,
  onOpenEntry,
  shownEntryCount,
  onShownEntryCountChange,
  emptyAction,
  showHeading = true,
}: PlayRecordsScreenProps) {
  const calendarLabelId = useId();
  const calendarWeeks = useMemo(
    () => createPlayCalendar(newestFirstEntries, now),
    [newestFirstEntries, now],
  );
  const calendarLabel = `直近${PLAY_CALENDAR_WEEK_COUNT}週`;

  return (
    <>
      {showHeading && (
        <header className="mt-2">
          <h1 className="text-screen-title">記録</h1>
        </header>
      )}
      <section
        aria-labelledby={calendarLabelId}
        className="mt-1 mb-6 grid justify-items-start gap-2"
      >
        <p id={calendarLabelId} className="text-meta text-muted-foreground">
          {calendarLabel}
        </p>
        <PlayCalendar
          oldestFirstWeeks={calendarWeeks}
          label={`${calendarLabel}に遊んだ日`}
        />
      </section>
      {newestFirstEntries.length === 0 ? (
        <EmptyRecords action={emptyAction} />
      ) : (
        <PlayDayList
          newestFirstEntries={newestFirstEntries}
          describeEntry={describeEntry}
          onOpenEntry={onOpenEntry}
          shownEntryCount={shownEntryCount}
          onShownEntryCountChange={onShownEntryCountChange}
        />
      )}
    </>
  );
}
