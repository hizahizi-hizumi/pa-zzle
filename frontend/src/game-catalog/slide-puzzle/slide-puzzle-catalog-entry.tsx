import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  isSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import type { SlidePuzzleGeneratedProblem } from "@/games/slide-puzzle/problem/problem";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";
import type { PlayRecord } from "@/records/play-record";

type SlidePuzzleReplayStart = {
  difficulty: SlidePuzzleDifficulty;
  initialProblem: SlidePuzzleGeneratedProblem;
};

function resolveSlidePuzzleReplayStart(
  record: PlayRecord,
): RecordReplayStart<SlidePuzzleReplayStart> {
  if (!isSlidePuzzlePlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  // 評価の基準になる最短手数は問題集にしか無いので、問題集に無い問題は再プレイできない。
  const initialProblem = restoreSlidePuzzlePooledProblem(
    record.payload.problemIdentity,
  );
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return {
    status: "available",
    start: { difficulty: record.payload.difficulty, initialProblem },
  };
}

export const slidePuzzleCatalogEntry = {
  id: slidePuzzlePlayRecordDefinition.gameId,
  name: "スライドパズル",
  pictogramSvg,
  entryPath: "/puzzles/slide-puzzle",
  playRecordDisplay: slidePuzzlePlayRecordDisplay,
  replayRecord(record) {
    return renderRecordReplay(
      resolveSlidePuzzleReplayStart(record),
      (start) => <PlayableSlidePuzzle {...start} />,
    );
  },
} satisfies GameCatalogEntry;

export const _private = { resolveSlidePuzzleReplayStart };
