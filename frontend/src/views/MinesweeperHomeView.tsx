import { useGameHome } from "@/game-catalog/game-home";
import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { MinesweeperDifficultyPreview } from "@/games/minesweeper/ui/MinesweeperDifficultyPreview";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function MinesweeperHomeView() {
  const { screenProps } = useGameHome(minesweeperCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderLevelPreview={(difficulty) => (
        <MinesweeperDifficultyPreview difficulty={difficulty} />
      )}
      renderHowToPlayDialog={({ open, onClose }) => (
        <MinesweeperHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
