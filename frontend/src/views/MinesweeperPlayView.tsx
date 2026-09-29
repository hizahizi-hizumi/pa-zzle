import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableMinesweeper } from "@/game-catalog/minesweeper/PlayableMinesweeper";
import { parseMinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useParams } from "@/router";

export function MinesweeperPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/minesweeper/play/:difficulty",
  );
  const difficulty = parseMinesweeperDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/minesweeper"
      />
    );
  }

  return <PlayableMinesweeper key={difficulty} difficulty={difficulty} />;
}
