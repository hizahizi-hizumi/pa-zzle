import { useGameHome } from "@/game-catalog/game-home";
import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { NanpureGround } from "@/games/nanpure/ui/NanpureGround";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

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
