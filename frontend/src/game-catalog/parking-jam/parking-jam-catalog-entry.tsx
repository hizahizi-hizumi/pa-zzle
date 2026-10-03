import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
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
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import { restoreProblemOrNull } from "@/games/problem-restoration";

/** 完了記録の開始条件。完了記録には以前の難易度区分で遊んだものもある。 */
type ParkingJamReplayConditions = {
  difficulty: string;
  problemIdentity: ParkingJamProblemIdentity;
};

type ParkingJamReplayStart = {
  difficulty: ParkingJamDifficulty;
  initialProblem: {
    restored: ParkingJamRestoredProblem;
  };
};

function resolveParkingJamReplayStart({
  difficulty: recordedDifficulty,
  problemIdentity,
}: ParkingJamReplayConditions): RecordReplayStart<ParkingJamReplayStart> {
  const difficulty = parseParkingJamDifficulty(recordedDifficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

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
  ...createGameReplay({
    readRecordConditions(record) {
      return isParkingJamPlayRecord(record) ? record.payload : null;
    },
    resolveStart: resolveParkingJamReplayStart,
    renderPlay(start) {
      return <PlayableParkingJam {...start} />;
    },
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveParkingJamReplayStart };
