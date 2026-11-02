import { useGameHome } from "@/game-catalog/game-home";
import { hitofudePuzzleCatalogEntry } from "@/game-catalog/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function HitofudePuzzleHomeView() {
  const { screenProps } = useGameHome(hitofudePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HitofudePuzzleHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
