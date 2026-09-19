import { useMemo, useState } from "react";

import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import type { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { useWaterSortPlay } from "@/games/water-sort/hooks/use-water-sort-play";
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
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { useNavigate } from "@/router";

type PlayableWaterSortProps = {
  difficulty: NonNullable<ReturnType<typeof parseWaterSortDifficulty>>;
};

export function PlayableWaterSort({ difficulty }: PlayableWaterSortProps) {
  const play = useWaterSortPlay(difficulty);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createWaterSortPlayRecord({
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
    waterSortPlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createWaterSortDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <WaterSortPlay
        {...play}
        recordOutcome={recordOutcome}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/water-sort")}
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
