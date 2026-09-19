import { useMemo } from "react";

import type { parseNanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/hooks/use-nanpure-play";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { useNavigate } from "@/router";

type PlayableNanpureProps = {
  difficulty: NonNullable<ReturnType<typeof parseNanpureDifficulty>>;
};

export function PlayableNanpure({ difficulty }: PlayableNanpureProps) {
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
      onChangeDifficulty={() => navigate("/puzzles/nanpure")}
      onBackToHome={() => navigate("/")}
    />
  );
}
