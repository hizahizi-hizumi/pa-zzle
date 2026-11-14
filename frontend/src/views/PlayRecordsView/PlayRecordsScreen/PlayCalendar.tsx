import type { PlayCalendarWeek } from "@/features/records/play-timeline";
import { getPlayCalendarDayClassName } from "@/views/PlayRecordsView/PlayRecordsScreen/play-calendar-appearance";

type PlayCalendarProps = {
  /** 各週は日曜から土曜。 */
  oldestFirstWeeks: readonly PlayCalendarWeek[];
  label: string;
};

export function PlayCalendar({ oldestFirstWeeks, label }: PlayCalendarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid grid-flow-col grid-rows-7 gap-0.75"
      style={{
        gridTemplateColumns: `repeat(${oldestFirstWeeks.length}, minmax(0, 2rem))`,
      }}
    >
      {oldestFirstWeeks.flatMap((week) =>
        week.map(({ dayStart, level }) => (
          <span
            key={dayStart}
            data-day-start={dayStart}
            data-play-amount={level ?? undefined}
            className={`aspect-square rounded-sm ${getPlayCalendarDayClassName(level)}`}
          />
        )),
      )}
    </div>
  );
}
