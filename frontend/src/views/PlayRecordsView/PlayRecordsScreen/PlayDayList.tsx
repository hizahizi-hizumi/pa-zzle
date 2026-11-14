import { useEffect, useMemo, useRef } from "react";
import type { PlayTimelineEntryDescription } from "@/app/game-integration/play-timeline-entry-description";
import {
  groupPlayTimelineByDay,
  type PlayTimelineEntry,
} from "@/features/records/play-timeline";
import { formatPlayedDay } from "@/features/records/ui/format-played-at";
import { PlayTimelineRow } from "@/views/PlayRecordsView/PlayRecordsScreen/PlayDayList/PlayTimelineRow";

type PlayDayListProps = {
  newestFirstEntries: readonly PlayTimelineEntry[];
  describeEntry: (entry: PlayTimelineEntry) => PlayTimelineEntryDescription;
  onOpenEntry: (entry: PlayTimelineEntry) => void;
  shownEntryCount: number;
  onShownEntryCountChange: (count: number) => void;
};

/** 記録が数千件あっても、開いたときは画面の数枚分だけを描く。 */
export const PLAY_DAY_LIST_BATCH_SIZE = 40;

/** 一覧の終わりがこの距離まで近づいたら、見える前に次の分を描き足す。 */
const PRELOAD_MARGIN = "800px";

/**
 * 全件を一度に描かず、新しいものから描き、一覧の終わりが近づくたびに描き足す。
 */
export function PlayDayList({
  newestFirstEntries,
  describeEntry,
  onOpenEntry,
  shownEntryCount,
  onShownEntryCountChange,
}: PlayDayListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const hasMore = shownEntryCount < newestFirstEntries.length;
  const days = useMemo(
    () => groupPlayTimelineByDay(newestFirstEntries.slice(0, shownEntryCount)),
    [newestFirstEntries, shownEntryCount],
  );

  // 描き足したあとも終わりが見えているときに続けて描き足せるよう、描き足すたびに見張り直す。
  useEffect(() => {
    const end = endRef.current;
    if (!hasMore || end === null) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      onShownEntryCountChange(newestFirstEntries.length);
      return;
    }
    const observer = new IntersectionObserver(
      ([observed]) => {
        if (observed?.isIntersecting) {
          onShownEntryCountChange(shownEntryCount + PLAY_DAY_LIST_BATCH_SIZE);
        }
      },
      { rootMargin: `0px 0px ${PRELOAD_MARGIN} 0px` },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [
    hasMore,
    shownEntryCount,
    newestFirstEntries.length,
    onShownEntryCountChange,
  ]);

  return (
    <>
      <ol aria-label="遊んだ日" className="grid gap-5">
        {days.map(({ dayStart, newestFirstEntries: dayEntries }) => (
          <li key={dayStart}>
            <h2 className="mb-2 text-meta text-muted-foreground tabular-nums">
              {formatPlayedDay(dayStart)}
            </h2>
            <ol className="grid gap-2">
              {dayEntries.map((entry) => (
                <li
                  key={
                    entry.kind === "cleared"
                      ? entry.record.id
                      : `${entry.attempt.gameId}:${entry.attempt.startedAt}`
                  }
                >
                  <PlayTimelineRow
                    entry={entry}
                    describeEntry={describeEntry}
                    onOpen={onOpenEntry}
                  />
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {hasMore && <div ref={endRef} aria-hidden="true" className="h-px" />}
    </>
  );
}
