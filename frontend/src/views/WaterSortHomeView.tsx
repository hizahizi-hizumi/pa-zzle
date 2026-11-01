import { useGameHome } from "@/game-catalog/game-home";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import { WaterSortDifficultyPreview } from "@/games/water-sort/ui/WaterSortDifficultyPreview";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function WaterSortHomeView() {
  const { screenProps } = useGameHome(waterSortCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderLevelPreview={(difficulty) => (
        <WaterSortDifficultyPreview difficulty={difficulty} />
      )}
      renderHowToPlayDialog={({ open, onClose }) => (
        <WaterSortHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
