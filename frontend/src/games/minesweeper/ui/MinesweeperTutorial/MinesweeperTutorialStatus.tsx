import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { StatusMetric } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus/StatusMetric";

export type MinesweeperTutorialToggleCue = {
  recallId: number | null;
};

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  mineCountSpotlit: boolean;
  mode: MinesweeperInputMode;
  toggleCue: MinesweeperTutorialToggleCue | null;
  toggleSpotlit: boolean;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/** 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mineCountSpotlit,
  mode,
  toggleCue,
  toggleSpotlit,
  onModeChange,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground text-play-meta">
        <StatusMetric
          label="地雷"
          value={mineCount}
          spotlit={mineCountSpotlit}
        />
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <StatusMetric label="旗" value={flagCount} spotlit={false} />
      </div>
      {/* 印と覆いから抜く形は、切り替えのボタンと同じ位置・大きさ・角丸にする。 */}
      <span className="relative flex rounded-md">
        <InputModeToggle mode={mode} onChange={onModeChange} />
        <TutorialSpotlight
          active={toggleSpotlit}
          className="inset-0 rounded-md"
        />
        {toggleCue !== null && (
          <span
            aria-hidden="true"
            data-toggle-cue="hint"
            className="pointer-events-none absolute inset-0 rounded-md"
          >
            <TutorialCue kind="mark" recallId={toggleCue.recallId} />
          </span>
        )}
      </span>
    </div>
  );
}
