import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { reflectionCatalogEntry } from "@/app/game-integration/reflection/reflection-catalog-entry";
import { ReflectionGround } from "@/games/reflection/ui/ReflectionGround";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";

export function ReflectionHomeView() {
  const { screenProps } = useGameHome(reflectionCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<ReflectionGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ReflectionHowToPlayDialog open={open} onClose={onClose} />
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
