import { parseMinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/MinesweeperPlayView/InvalidDifficulty";
import { PlayableMinesweeper } from "@/views/MinesweeperPlayView/PlayableMinesweeper";

export function MinesweeperPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/minesweeper/play/:difficulty",
  );
  const difficulty = parseMinesweeperDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableMinesweeper key={difficulty} difficulty={difficulty} />;
}
