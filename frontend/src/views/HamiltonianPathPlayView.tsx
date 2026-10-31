import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { hamiltonianPathCatalogEntry } from "@/game-catalog/hamiltonian-path/hamiltonian-path-catalog-entry";
import { PlayableHamiltonianPath } from "@/game-catalog/hamiltonian-path/PlayableHamiltonianPath";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function HamiltonianPathPlayView() {
  const { difficulty: difficultyParam } = useParams(
    hamiltonianPathCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={hamiltonianPathCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableHamiltonianPath
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
