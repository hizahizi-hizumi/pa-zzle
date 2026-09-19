import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNanpureDifficulty } from "@/games/nanpure/game/difficulty";
import { useNanpureGame } from "@/games/nanpure/hooks/use-nanpure-game";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { useSavePlayRecord } from "@/records/ui/use-save-play-record";
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
  const playRecord = useMemo(
    () =>
      game.result && game.completedAt !== null
        ? createNanpurePlayRecord({
            difficulty,
            problemIdentity: game.problemIdentity,
            startedAt: game.startedAt,
            completedAt: game.completedAt,
            result: game.result,
          })
        : null,
    [
      difficulty,
      game.completedAt,
      game.problemIdentity,
      game.result,
      game.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    nanpurePlayRecordDefinition,
  );

  return (
    <NanpurePlay
      {...game}
      recordOutcome={recordOutcome}
      onOpenRecords={() => navigate("/records")}
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
