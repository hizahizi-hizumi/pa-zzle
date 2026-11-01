import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { nonogramCatalogEntry } from "@/game-catalog/nonogram/nonogram-catalog-entry";
import { PlayableNonogram } from "@/game-catalog/nonogram/PlayableNonogram";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function NonogramPlayView() {
  const { difficulty: difficultyParam } = useParams(
    nonogramCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={nonogramCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableNonogram
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
