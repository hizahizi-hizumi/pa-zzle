import { useGameHome } from "@/game-catalog/game-home";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { ParkingJamGround } from "@/games/parking-jam/ui/ParkingJamGround";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function ParkingJamHomeView() {
  const { screenProps } = useGameHome(parkingJamCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<ParkingJamGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <ParkingJamHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <ParkingJamTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
