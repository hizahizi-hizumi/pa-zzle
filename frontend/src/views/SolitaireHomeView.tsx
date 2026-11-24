import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { solitaireCatalogEntry } from "@/app/game-integration/solitaire/solitaire-catalog-entry";
import { SolitaireGround } from "@/games/solitaire/ui/SolitaireGround";
import { SolitaireHowToPlayDialog } from "@/games/solitaire/ui/SolitaireHowToPlayDialog";

export function SolitaireHomeView() {
  const { screenProps } = useGameHome(solitaireCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<SolitaireGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <SolitaireHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
