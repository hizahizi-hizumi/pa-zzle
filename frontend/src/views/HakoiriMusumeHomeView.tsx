import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { hakoiriMusumeCatalogEntry } from "@/app/game-integration/hakoiri-musume/hakoiri-musume-catalog-entry";
import { HakoiriMusumeGround } from "@/games/hakoiri-musume/ui/HakoiriMusumeGround";
import { HakoiriMusumeHowToPlayDialog } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog";
import { HakoiriMusumeTutorial } from "@/games/hakoiri-musume/ui/HakoiriMusumeTutorial";

export function HakoiriMusumeHomeView() {
  const { screenProps } = useGameHome(hakoiriMusumeCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<HakoiriMusumeGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HakoiriMusumeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <HakoiriMusumeTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
