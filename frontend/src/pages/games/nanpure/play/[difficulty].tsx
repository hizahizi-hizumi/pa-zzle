import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNanpureDifficulty } from "@/games/nanpure/game/difficulty";
import { useNanpureGame } from "@/games/nanpure/hooks/use-nanpure-game";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { Link, useNavigate, useParams } from "@/router";

export default function NanpurePlayPage() {
  const { difficulty: difficultyParam } = useParams(
    "/games/nanpure/play/:difficulty",
  );
  const difficulty = parseNanpureDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableNanpure difficulty={difficulty} />;
}

function PlayableNanpure({
  difficulty,
}: {
  difficulty: NonNullable<ReturnType<typeof parseNanpureDifficulty>>;
}) {
  const game = useNanpureGame(difficulty);
  const navigate = useNavigate();

  return (
    <NanpurePlay
      {...game}
      onChangeDifficulty={() => navigate("/games/nanpure")}
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
          <Link to="/games/nanpure">難易度選択へ戻る</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
