import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperInputModeToggle } from "@/games/minesweeper/ui/board/MinesweeperInputModeToggle";
import { cn } from "@/lib/utils";

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  mode: MinesweeperInputMode;
  /** 盤面全体の地雷の数を、見るところとして目立たせる。 */
  mineCountFocused: boolean;
  /** 切り替えのボタンに、次に押すところとして印を付ける。 */
  modeCued: boolean;
  modeCueId: number;
  /** 本番と同じく、操作を受け付けない間は切り替えを見せない。場所は取ったままにして盤面を動かさない。 */
  modeHidden: boolean;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/** 本番の見出しと同じく、地雷・旗・ミスの数と、開くか旗かの切り替えを、盤面の上に並べる。 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mistakeCount,
  mode,
  mineCountFocused,
  modeCued,
  modeCueId,
  modeHidden,
  onModeChange,
}: MinesweeperTutorialStatusProps) {
  const counts = [
    { label: "地雷", count: mineCount, focused: mineCountFocused },
    { label: "旗", count: flagCount, focused: false },
    { label: "ミス", count: mistakeCount, focused: false },
  ];
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3">
      <dl className="flex items-center gap-1 text-supporting">
        {counts.map(function renderCount({ label, count, focused }) {
          return (
            <div
              key={label}
              data-focused={focused || undefined}
              className={cn(
                "flex items-baseline gap-1 rounded-md px-2 py-1 transition-colors duration-(--duration-normal)",
                focused &&
                  "bg-sky-100 ring-2 ring-sky-500/60 ring-inset dark:bg-sky-900/60 dark:ring-sky-300/60",
              )}
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {count}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className={cn("flex", modeHidden && "invisible")}>
        <MinesweeperInputModeToggle
          mode={mode}
          cued={modeCued}
          cueId={modeCueId}
          disabled={modeHidden}
          onChange={onModeChange}
        />
      </div>
    </div>
  );
}
