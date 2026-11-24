import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { fukumenzanCatalogEntry } from "@/app/game-integration/fukumenzan/fukumenzan-catalog-entry";
import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";
import { FukumenzanHowToPlayDialog } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog";

export function FukumenzanHomeView() {
  const { screenProps } = useGameHome(fukumenzanCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<FukumenzanGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <FukumenzanHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
    />
  );
}
