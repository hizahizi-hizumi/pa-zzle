import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import { parseWaterSortDifficulty } from "@/games/water-sort/game/difficulty";
import { useWaterSortGame } from "@/games/water-sort/hooks/use-water-sort-game";
import {
  createWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import { WaterSortDiagnostics } from "@/games/water-sort/ui/WaterSortDiagnostics";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/use-save-play-record";
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
  const playRecord = useMemo(
    () =>
      game.result && game.completedAt !== null
        ? createWaterSortPlayRecord({
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
    waterSortPlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createWaterSortDiagnosticSnapshot({
        difficulty: game.difficulty,
        problemIdentity: game.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <WaterSortPlay
        {...game}
        recordOutcome={recordOutcome}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/games/water-sort")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && (
        <WaterSortDiagnostics
          snapshot={diagnostics}
          open={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
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
