import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import {
  type ParkingJamDifficulty,
  parseParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import {
  type ParkingJamRestoredProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import { parkingJamPlayAttemptDisplay } from "@/games/parking-jam/ui/play-attempt-display";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import { restoreProblemOrNull } from "@/games/problem-restoration";
import type { PlayRecord } from "@/records/play-record";

type ParkingJamReplayStart = {
  difficulty: ParkingJamDifficulty;
  initialProblem: {
    restored: ParkingJamRestoredProblem;
  };
};

function resolveParkingJamReplayStart(
  record: PlayRecord,
): RecordReplayStart<ParkingJamReplayStart> {
  if (!isParkingJamPlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  const difficulty = parseParkingJamDifficulty(record.payload.difficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

  const { problemIdentity } = record.payload;
  const restored = restoreProblemOrNull(() =>
    restoreParkingJamProblemWithoutAnalysis(problemIdentity),
  );
  if (!restored) {
    return unavailableRecordReplay("problem-not-restorable");
  }

  return {
    status: "available",
    start: { difficulty, initialProblem: { restored } },
  };
}

export const parkingJamCatalogEntry = {
  id: parkingJamPlayRecordDefinition.gameId,
  name: "パーキングジャム",
  pictogramSvg,
  entryPath: "/puzzles/parking-jam",
  playRecordDisplay: parkingJamPlayRecordDisplay,
  playAttemptDisplay: parkingJamPlayAttemptDisplay,
  replayRecord(record) {
    return renderRecordReplay(resolveParkingJamReplayStart(record), (start) => (
      <PlayableParkingJam {...start} />
    ));
  },
} satisfies GameCatalogEntry;

export const _private = { resolveParkingJamReplayStart };
