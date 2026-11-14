import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { MinesweeperGround } from "@/games/minesweeper/ui/MinesweeperGround";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";

export function MinesweeperHomeView() {
  const { screenProps } = useGameHome(minesweeperCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<MinesweeperGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <MinesweeperHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <MinesweeperTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
