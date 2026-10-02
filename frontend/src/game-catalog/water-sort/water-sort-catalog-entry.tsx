import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { restoreProblemOrNull } from "@/games/problem-restoration";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  parseWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import { isWaterSortPlayAttempt } from "@/games/water-sort/play-attempt";
import {
  isWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import { restoreWaterSortProblem } from "@/games/water-sort/problem/generator";
import type {
  WaterSortGeneratedProblem,
  WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import { waterSortPlayAttemptDisplay } from "@/games/water-sort/ui/play-attempt-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";

/** 完了記録と試行に共通する開始条件。完了記録には以前の難易度区分で遊んだものもある。 */
type WaterSortReplayConditions = {
  difficulty: string;
  problemIdentity: WaterSortProblemIdentity;
};

type WaterSortReplayStart = {
  difficulty: WaterSortDifficulty;
  initialProblem: WaterSortGeneratedProblem;
};

function resolveWaterSortReplayStart({
  difficulty: recordedDifficulty,
  problemIdentity,
}: WaterSortReplayConditions): RecordReplayStart<WaterSortReplayStart> {
  const difficulty = parseWaterSortDifficulty(recordedDifficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

  const initialProblem = restoreProblemOrNull(() =>
    restoreWaterSortProblem(problemIdentity),
  );
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-restorable");
  }

  return { status: "available", start: { difficulty, initialProblem } };
}

export const waterSortCatalogEntry = {
  id: waterSortPlayRecordDefinition.gameId,
  name: "ウォーターソート",
  pictogramSvg,
  entryPath: "/puzzles/water-sort",
  playRecordDisplay: waterSortPlayRecordDisplay,
  playAttemptDisplay: waterSortPlayAttemptDisplay,
  ...createGameReplay({
    readRecordConditions(record) {
      return isWaterSortPlayRecord(record) ? record.payload : null;
    },
    readAttemptConditions(attempt) {
      return isWaterSortPlayAttempt(attempt) ? attempt.start : null;
    },
    resolveStart: resolveWaterSortReplayStart,
    renderPlay(start) {
      return <PlayableWaterSort {...start} />;
    },
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveWaterSortReplayStart };
