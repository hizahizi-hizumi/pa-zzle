import { useGameHome } from "@/game-catalog/game-home";
import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { NanpureDifficultyPreview } from "@/games/nanpure/ui/NanpureDifficultyPreview";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function NanpureHomeView() {
  const { screenProps } = useGameHome(nanpureCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderLevelPreview={(difficulty) => (
        <NanpureDifficultyPreview difficulty={difficulty} />
      )}
      renderHowToPlayDialog={({ open, onClose }) => (
        <NanpureHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
