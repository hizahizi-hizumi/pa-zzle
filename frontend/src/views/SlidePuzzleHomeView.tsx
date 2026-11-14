import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { slidePuzzleCatalogEntry } from "@/app/game-integration/slide-puzzle/slide-puzzle-catalog-entry";
import { SlidePuzzleGround } from "@/games/slide-puzzle/ui/SlidePuzzleGround";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";

export function SlidePuzzleHomeView() {
  const { screenProps } = useGameHome(slidePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<SlidePuzzleGround />}
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
