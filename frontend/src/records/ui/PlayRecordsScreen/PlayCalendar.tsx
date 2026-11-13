import type { PlayCalendarWeek } from "@/records/play-timeline";
import { getPlayCalendarDayClassName } from "@/records/ui/PlayRecordsScreen/play-calendar-appearance";

type PlayCalendarProps = {
  /** 古い週から。各週は日曜から土曜。 */
  weeks: readonly PlayCalendarWeek[];
  label: string;
};

export function PlayCalendar({ weeks, label }: PlayCalendarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid grid-flow-col grid-rows-7 gap-0.75"
      style={{
        gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 2rem))`,
      }}
    >
      {weeks.flatMap((week) =>
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
