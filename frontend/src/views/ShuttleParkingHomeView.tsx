import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { shuttleParkingCatalogEntry } from "@/app/game-integration/shuttle-parking/shuttle-parking-catalog-entry";
import { ShuttleParkingGround } from "@/games/shuttle-parking/ui/ShuttleParkingGround";
import { ShuttleParkingHowToPlayDialog } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog";
import { ShuttleParkingTutorial } from "@/games/shuttle-parking/ui/ShuttleParkingTutorial";

export function ShuttleParkingHomeView() {
  const { screenProps } = useGameHome(shuttleParkingCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<ShuttleParkingGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <ShuttleParkingHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <ShuttleParkingTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
