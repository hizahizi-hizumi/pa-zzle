import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { reflectionCatalogEntry } from "@/app/game-integration/reflection/reflection-catalog-entry";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";

export function ReflectionHomeView() {
  const { screenProps } = useGameHome(reflectionCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <ReflectionHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <ReflectionTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
