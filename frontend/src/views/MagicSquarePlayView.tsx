import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { magicSquareCatalogEntry } from "@/app/game-integration/magic-square/magic-square-catalog-entry";
import { PlayableMagicSquare } from "@/app/game-integration/magic-square/PlayableMagicSquare";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function MagicSquarePlayView() {
  const { problemId } = useParams(magicSquareCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    magicSquareCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={magicSquareCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableMagicSquare
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
