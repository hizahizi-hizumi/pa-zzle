import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { InputModeToggle } from "@/games/minesweeper/ui/board/InputModeToggle";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperGround } from "@/games/minesweeper/ui/MinesweeperGround";

type ModeToggleProps = {
  mode: MinesweeperInputMode;
  /** 次に押す所としてボタンに手がかりを付けるか。 */
  hinted: boolean;
  onChange: (mode: MinesweeperInputMode) => void;
};

/**
 * 例の盤面の右上に置く、本番と同じ旗の切り替えのボタン。押すと本番と同じに旗と開くを切り替える。
 * 本番のボタンはプレイ画面の地の上にあり、旗に切り替えた姿の面は例を並べる面と同じ色で消えるので、プレイ画面と同じ地の台に載せる。
 * 次に押す所のときは、台の外側を手がかりの破線で囲む。開くのときのボタンは本番どおり指の絵なので、手がかりの指は置かず、指が2本並ばないようにする。
 */
export function ModeToggle({ mode, hinted, onChange }: ModeToggleProps) {
  return (
    <span className="relative flex overflow-visible rounded-lg">
      <span className="relative flex overflow-hidden rounded-lg p-1">
        <span aria-hidden="true" className="absolute inset-0">
          <MinesweeperGround />
        </span>
        <span className="relative flex">
          <InputModeToggle mode={mode} onChange={onChange} />
        </span>
      </span>
      {hinted ? (
        <HowToPlayPressHint frame="outside" outline="rounded" pointer="none" />
      ) : null}
    </span>
  );
}
