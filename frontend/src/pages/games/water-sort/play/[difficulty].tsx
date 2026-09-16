import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseWaterSortDifficulty } from "@/games/water-sort/game/difficulty";
import { useWaterSortGame } from "@/games/water-sort/hooks/use-water-sort-game";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";
import { Link, useNavigate, useParams } from "@/router";

export default function WaterSortPlayPage() {
  const { difficulty: difficultyParam } = useParams(
    "/games/water-sort/play/:difficulty",
  );
  const difficulty = parseWaterSortDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableWaterSort difficulty={difficulty} />;
}

function PlayableWaterSort({
  difficulty,
}: {
  difficulty: NonNullable<ReturnType<typeof parseWaterSortDifficulty>>;
}) {
  const game = useWaterSortGame(difficulty);
  const navigate = useNavigate();

  return (
    <WaterSortPlay
      {...game}
      onChangeDifficulty={() => navigate("/games/water-sort")}
      onBackToHome={() => navigate("/")}
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
          <Link to="/games/water-sort">難易度選択へ戻る</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
