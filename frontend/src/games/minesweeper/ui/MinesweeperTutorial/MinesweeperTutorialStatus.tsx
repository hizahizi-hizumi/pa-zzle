import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { cn } from "@/lib/utils";

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  /** 地雷の総数を、次の操作を決める手がかりとして示す。 */
  mineCountCued: boolean;
  mode: MinesweeperInputMode;
  /** 切り替えに付ける印。`id` が変わるたびに一瞬光らせて付け直す。`null` なら付けない。 */
  toggleCueId: number | null;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

type StatusMetricProps = {
  label: string;
  value: number;
  cued?: boolean;
};

/** 本番の見出しの計測値と同じ書式で、名前と数を並べる。 */
function StatusMetric({ label, value, cued = false }: StatusMetricProps) {
  return (
    <span
      data-status-cue={cued ? "clue" : undefined}
      className={cn(
        "flex items-baseline gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5",
        cued &&
          "bg-sky-100/80 text-foreground ring-2 ring-sky-500/60 animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:bg-sky-900/60 dark:ring-sky-300/60",
      )}
    >
      <span>{label}</span>
      <span className="min-w-[2ch] text-left font-medium font-mono text-foreground/80 tabular-nums">
        {value}
      </span>
    </span>
  );
}

/**
 * 盤面の上に、本番の見出しと同じ書式の地雷と旗の数と、本番と同じ旗の切り替えを並べる。
 * 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。
 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mineCountCued,
  mode,
  toggleCueId,
  onModeChange,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="flex items-center gap-1 text-muted-foreground text-play-meta">
        <StatusMetric label="地雷" value={mineCount} cued={mineCountCued} />
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <StatusMetric label="旗" value={flagCount} />
      </div>
      <span className="relative flex">
        <InputModeToggle mode={mode} onChange={onModeChange} />
        {toggleCueId !== null && (
          <span
            key={toggleCueId}
            aria-hidden="true"
            data-toggle-cue="hint"
            className="pointer-events-none absolute -inset-1 overflow-hidden rounded-lg border-[3px] border-sky-600 border-dashed dark:border-sky-400"
          >
            <span className="absolute inset-0 bg-sky-200/70 fill-mode-forwards animate-out fade-out-0 duration-700 ease-in dark:bg-sky-800/60" />
          </span>
        )}
      </span>
    </div>
  );
}
