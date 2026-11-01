import { MetricSeparator } from "@/components/PlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/components/PlayHeader/PlayHeaderSummary/PlayMetric";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { InputModeToggle } from "@/games/minesweeper/ui/MinesweeperPlay/InputModeToggle";

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  mode: MinesweeperInputMode;
  /** 切り替えに付ける印。`id` が変わると付け直す。`null` なら付けない。 */
  toggleCueId: number | null;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/**
 * 盤面の上に、本番の見出しと同じ書式の地雷と旗の数と、本番と同じ旗の切り替えを並べる。
 * 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。
 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mode,
  toggleCueId,
  onModeChange,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground text-play-meta">
        <PlayMetric label="地雷" value={String(mineCount)} reservedDigits={2} />
        <MetricSeparator />
        <PlayMetric label="旗" value={String(flagCount)} reservedDigits={2} />
      </div>
      <span className="relative flex">
        <InputModeToggle mode={mode} onChange={onModeChange} />
        {toggleCueId !== null && (
          <span
            key={toggleCueId}
            aria-hidden="true"
            data-toggle-cue="hint"
            className="pointer-events-none absolute -inset-1 rounded-lg border-[3px] border-sky-600 border-dashed animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:border-sky-400"
          />
        )}
      </span>
    </div>
  );
}
