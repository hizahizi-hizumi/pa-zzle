import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { NanpureGround } from "@/games/nanpure/ui/NanpureGround";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";

export function NanpureHomeView() {
  const { screenProps } = useGameHome(nanpureCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<NanpureGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <NanpureHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <NanpureTutorial open={open} playStart={playStart} onClose={onClose} />
      )}
    />
  );
}
