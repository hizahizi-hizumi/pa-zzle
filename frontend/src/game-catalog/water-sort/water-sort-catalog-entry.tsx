import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { restoreProblemOrNull } from "@/games/problem-restoration";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  parseWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import {
  isWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import { restoreWaterSortProblem } from "@/games/water-sort/problem/generator";
import type { WaterSortGeneratedProblem } from "@/games/water-sort/problem/problem";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import type { PlayRecord } from "@/records/play-record";

type WaterSortReplayStart = {
  difficulty: WaterSortDifficulty;
  initialProblem: WaterSortGeneratedProblem;
};

function resolveWaterSortReplayStart(
  record: PlayRecord,
): RecordReplayStart<WaterSortReplayStart> {
  if (!isWaterSortPlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  const difficulty = parseWaterSortDifficulty(record.payload.difficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

  const { problemIdentity } = record.payload;
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
  replayRecord(record) {
    return renderRecordReplay(resolveWaterSortReplayStart(record), (start) => (
      <PlayableWaterSort {...start} />
    ));
  },
} satisfies GameCatalogEntry;

export const _private = { resolveWaterSortReplayStart };
