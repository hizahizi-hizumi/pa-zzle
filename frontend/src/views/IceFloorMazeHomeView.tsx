import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { iceFloorMazeCatalogEntry } from "@/app/game-integration/ice-floor-maze/ice-floor-maze-catalog-entry";
import { IceFloorMazeGround } from "@/games/ice-floor-maze/ui/IceFloorMazeGround";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";

export function IceFloorMazeHomeView() {
  const { screenProps } = useGameHome(iceFloorMazeCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<IceFloorMazeGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <IceFloorMazeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <IceFloorMazeTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
