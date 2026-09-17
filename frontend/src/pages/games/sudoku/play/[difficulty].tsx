import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseSudokuDifficulty } from "@/games/sudoku/game/difficulty";
import { useSudokuGame } from "@/games/sudoku/hooks/use-sudoku-game";
import { SudokuPlay } from "@/games/sudoku/ui/SudokuPlay";
import { Link, useNavigate, useParams } from "@/router";

export default function SudokuPlayPage() {
  const { difficulty: difficultyParam } = useParams(
    "/games/sudoku/play/:difficulty",
  );
  const difficulty = parseSudokuDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableSudoku difficulty={difficulty} />;
}

function PlayableSudoku({
  difficulty,
}: {
  difficulty: NonNullable<ReturnType<typeof parseSudokuDifficulty>>;
}) {
  const game = useSudokuGame(difficulty);
  const navigate = useNavigate();

  return (
    <SudokuPlay
      {...game}
      onChangeDifficulty={() => navigate("/games/sudoku")}
    />
  );
}

function InvalidDifficulty() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>この難易度は選べません</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/games/sudoku">難易度選択へ戻る</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
