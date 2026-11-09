import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { StatusMetric } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus/StatusMetric";

/**
 * 切り替えに付ける、次に押す所の印。
 * - `recallId`: 印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 */
export type MinesweeperTutorialToggleCue = {
  recallId: number | null;
};

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  /** 手を引いている間、地雷の総数を次の操作を決める手がかりとして覆いから抜く。 */
  mineCountSpotlit: boolean;
  mode: MinesweeperInputMode;
  /** 切り替えに付ける印。`null` なら付けない。 */
  toggleCue: MinesweeperTutorialToggleCue | null;
  /** 手を引いている間、次に押す所として切り替えを覆いから抜く。 */
  toggleSpotlit: boolean;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/**
 * 盤面の上に、本番の見出しと同じ書式の地雷と旗の数と、本番と同じ旗の切り替えを並べる。
 * 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。
 */
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
