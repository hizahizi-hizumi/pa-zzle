import { useGameHome } from "@/game-catalog/game-home";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function SlidePuzzleHomeView() {
  const { screenProps } = useGameHome(slidePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <SlidePuzzleHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <SlidePuzzleTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
