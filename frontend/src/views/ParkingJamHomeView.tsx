import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import { ParkingJamGround } from "@/games/parking-jam/ui/ParkingJamGround";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";

export function ParkingJamHomeView() {
  const { screenProps } = useGameHome(parkingJamCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<ParkingJamGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ParkingJamHowToPlayDialog open={open} onClose={onClose} />
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
