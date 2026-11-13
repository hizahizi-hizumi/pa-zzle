import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";

export function NanpureHomeView() {
  const { screenProps } = useGameHome(nanpureCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <NanpureHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <NanpureTutorial open={open} playStart={playStart} onClose={onClose} />
      )}
    />
  );
}
