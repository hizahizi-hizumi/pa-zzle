import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableSolitaire } from "@/app/game-integration/solitaire/PlayableSolitaire";
import { solitaireCatalogEntry } from "@/app/game-integration/solitaire/solitaire-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function SolitairePlayView() {
  const { problemId } = useParams(solitaireCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    solitaireCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={solitaireCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableSolitaire
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
