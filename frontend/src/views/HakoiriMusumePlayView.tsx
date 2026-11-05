import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { hakoiriMusumeCatalogEntry } from "@/game-catalog/hakoiri-musume/hakoiri-musume-catalog-entry";
import { PlayableHakoiriMusume } from "@/game-catalog/hakoiri-musume/PlayableHakoiriMusume";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function HakoiriMusumePlayView() {
  const { difficulty: difficultyParam } = useParams(
    hakoiriMusumeCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={hakoiriMusumeCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableHakoiriMusume
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
