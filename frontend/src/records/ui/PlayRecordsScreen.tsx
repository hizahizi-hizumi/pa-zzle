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
  /** ゲームをまたいだ、クリアしたプレイと離脱したプレイ。新しい順。 */
  entries: readonly PlayTimelineEntry[];
  /** カレンダーの今日を決める時刻。 */
  now: number;
  /** 1件に示すゲーム・レベル・問題・評価点を求める。一覧に描く行の分だけ求める。 */
  describeEntry: (entry: PlayTimelineEntry) => PlayTimelineEntryDescription;
  onOpenEntry: (entry: PlayTimelineEntry) => void;
  /** 一覧に新しいものから描くプレイの数。一覧の終わりが近づくと、描き足した数で `onShownEntryCountChange` を呼ぶ。 */
  shownEntryCount: number;
  onShownEntryCountChange: (count: number) => void;
  emptyAction: ReactNode;
};

/** 記録画面を開いたときに一覧に描くプレイの数。 */
export const INITIAL_SHOWN_ENTRY_COUNT = PLAY_DAY_LIST_BATCH_SIZE;

/**
 * 記録画面。いつ・何を遊んだかを、ゲームをまたいだ時間の流れで示す。
 * 上に直近の週のカレンダーで日ごとに遊んだ量を、その下に遊んだ日ごとのプレイを新しい順に並べる。
 * 成績の比較（自己ベスト・推移）は示さない。
 */
export function PlayRecordsScreen({
  entries,
  now,
  describeEntry,
  onOpenEntry,
  shownEntryCount,
  onShownEntryCountChange,
  emptyAction,
}: PlayRecordsScreenProps) {
  const calendarLabelId = useId();
  const calendarWeeks = useMemo(
    () => createPlayCalendar(entries, now),
    [entries, now],
  );
  const calendarLabel = `直近${PLAY_CALENDAR_WEEK_COUNT}週`;

  return (
    <>
      <header className="mt-2">
        <h1 className="text-screen-title">記録</h1>
      </header>
      <section
        aria-labelledby={calendarLabelId}
        className="mt-1 mb-6 grid justify-items-start gap-2"
      >
        <p id={calendarLabelId} className="text-meta text-muted-foreground">
          {calendarLabel}
        </p>
        <PlayCalendar
          weeks={calendarWeeks}
          label={`${calendarLabel}に遊んだ日`}
        />
      </section>
      {entries.length === 0 ? (
        <EmptyRecords action={emptyAction} />
      ) : (
        <PlayDayList
          entries={entries}
          describeEntry={describeEntry}
          onOpenEntry={onOpenEntry}
          shownEntryCount={shownEntryCount}
          onShownEntryCountChange={onShownEntryCountChange}
        />
      )}
    </>
  );
}
