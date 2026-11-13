import { TutorialCue } from "@/components/TutorialCue";
import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { StatusMetric } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus/StatusMetric";

export type MinesweeperTutorialToggleCue = {
  recallId: number | null;
  // 輪郭に加えて、押すしぐさをする指で指す。
  pointed: boolean;
};

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  mode: MinesweeperInputMode;
  toggleCue: MinesweeperTutorialToggleCue | null;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/** チュートリアルの上部には本番の見出しが無いので、地雷と旗の数と旗の切り替えを、盤面と一緒に見える位置に置く。 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mode,
  toggleCue,
  onModeChange,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground text-play-meta">
        <StatusMetric label="地雷" value={mineCount} />
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <StatusMetric label="旗" value={flagCount} />
      </div>
      {/* 印は、切り替えのボタンと同じ位置・大きさ・角丸にする。 */}
      <span className="relative flex rounded-md">
        <InputModeToggle mode={mode} onChange={onModeChange} />
        {toggleCue !== null && (
          <span
            aria-hidden="true"
            data-toggle-cue="hint"
            className="pointer-events-none absolute inset-0 rounded-md"
          >
            {toggleCue.pointed ? (
              // 下の縁を指すと盤面の右上のマスに指がかかるので、ボタンの中を指す。
              <TutorialCue
                kind="pointer"
                placement="center"
                recallId={toggleCue.recallId}
              />
            ) : (
              <TutorialCue kind="mark" recallId={toggleCue.recallId} />
            )}
          </span>
        )}
      </span>
    </div>
  );
}
