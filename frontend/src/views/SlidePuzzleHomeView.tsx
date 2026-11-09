import { useGameHome } from "@/game-catalog/game-home";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { SlidePuzzleGround } from "@/games/slide-puzzle/ui/SlidePuzzleGround";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function SlidePuzzleHomeView() {
  const { screenProps } = useGameHome(slidePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<SlidePuzzleGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <SlidePuzzleHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
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
