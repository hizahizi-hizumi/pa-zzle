import { useGameHome } from "@/game-catalog/game-home";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import { WaterSortGround } from "@/games/water-sort/ui/WaterSortGround";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function WaterSortHomeView() {
  const { screenProps } = useGameHome(waterSortCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<WaterSortGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <WaterSortHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <WaterSortTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
