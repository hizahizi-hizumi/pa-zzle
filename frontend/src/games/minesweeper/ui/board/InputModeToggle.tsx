import { PlayActionButton } from "@/components/PlayActionButton";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MINESWEEPER_FLAG_MODE_ACTIVE_CLASS_NAME } from "@/games/minesweeper/ui/minesweeper-tone";
import { RaisedFlag } from "@/games/minesweeper/ui/RaisedFlag";

type InputModeToggleProps = {
  mode: MinesweeperInputMode;
  disabled: boolean;
  onChange: (mode: MinesweeperInputMode) => void;
};

/**
 * マスを押したときに旗を置く入力へ切り替える操作。押すたびにオン・オフし、オフの間はマスを開く。
 * 旗は盤面に置く旗と同じ形で描き、オンの間は旗の色の淡い地に濃い旗とラベルで示す。
 */
export function InputModeToggle({
  mode,
  disabled,
  onChange,
}: InputModeToggleProps) {
  const isFlagMode = mode === "flag";

  function toggleMode(): void {
    onChange(isFlagMode ? "reveal" : "flag");
  }

  return (
    <PlayActionButton
      icon={<RaisedFlag size="control" />}
      label="旗"
      active={isFlagMode}
      activeClassName={MINESWEEPER_FLAG_MODE_ACTIVE_CLASS_NAME}
      disabled={disabled}
      onClick={toggleMode}
    />
  );
}
