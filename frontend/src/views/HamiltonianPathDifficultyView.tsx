import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { hamiltonianPathCatalogEntry } from "@/game-catalog/hamiltonian-path/hamiltonian-path-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import { HamiltonianPathHowToPlayDialog } from "@/games/hamiltonian-path/ui/HamiltonianPathHowToPlayDialog";

export function HamiltonianPathDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={HAMILTONIAN_PATH_DISPLAY_NAME}
          gameId={hamiltonianPathCatalogEntry.id}
          renderHowToPlayDialog={({ open, onClose }) => (
            <HamiltonianPathHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={hamiltonianPathCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            {/* 難易度ごとの盤面の見本は、難易度の構成が決まってから置く。 */}
            {null}
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
