import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";

/**
 * 切り替えに付ける、次に押す所の印。
 * - `recallId`: 印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 */
export type MinesweeperTutorialToggleCue = {
  recallId: number | null;
};

type MinesweeperTutorialModeToggleProps = {
  mode: MinesweeperInputMode;
  disabled: boolean;
  /** 切り替えに付ける印。`null` なら付けない。 */
  cue: MinesweeperTutorialToggleCue | null;
  /** 手を引いている間、次に押す所として切り替えを覆いから抜く。 */
  spotlit: boolean;
  onModeChange: (mode: MinesweeperInputMode) => void;
};

/** 本番の盤の下の帯と同じ3列の中央に旗の切り替えを置き、印と覆いから抜く形を重ねる。 */
export function MinesweeperTutorialModeToggle({
  mode,
  disabled,
  cue,
  spotlit,
  onModeChange,
}: MinesweeperTutorialModeToggleProps) {
  return (
    <div className="grid grid-cols-3">
      {/* 印と覆いから抜く形は、切り替えのボタンと同じ位置・大きさ・角丸にする。 */}
      <span className="relative col-start-2 grid rounded-md">
        <InputModeToggle
          mode={mode}
          disabled={disabled}
          onChange={onModeChange}
        />
        <TutorialSpotlight active={spotlit} className="inset-0 rounded-md" />
        {cue !== null && (
          <span
            aria-hidden="true"
            data-toggle-cue="hint"
            className="pointer-events-none absolute inset-0 rounded-md"
          >
            <TutorialCue kind="mark" recallId={cue.recallId} />
          </span>
        )}
      </span>
    </div>
  );
}
