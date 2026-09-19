import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { useSavePlayRecord } from "@/records/use-save-play-record";
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
  const play = useNanpurePlay(difficulty);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createNanpurePlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            startedAt: play.startedAt,
            completedAt: play.completedAt,
            result: play.result,
          })
        : null,
    [
      difficulty,
      play.completedAt,
      play.problemIdentity,
      play.result,
      play.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    nanpurePlayRecordDefinition,
  );

  return (
    <NanpurePlay
      {...play}
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
