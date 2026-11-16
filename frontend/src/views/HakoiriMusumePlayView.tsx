import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { hakoiriMusumeCatalogEntry } from "@/app/game-integration/hakoiri-musume/hakoiri-musume-catalog-entry";
import { PlayableHakoiriMusume } from "@/app/game-integration/hakoiri-musume/PlayableHakoiriMusume";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function HakoiriMusumePlayView() {
  const { problemId } = useParams(hakoiriMusumeCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    hakoiriMusumeCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={hakoiriMusumeCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableHakoiriMusume
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
