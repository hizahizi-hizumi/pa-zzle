import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  isSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import type {
  SlidePuzzleGeneratedProblem,
  SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";

/** 完了記録の開始条件。 */
type SlidePuzzleReplayConditions = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
};

type SlidePuzzleReplayStart = {
  difficulty: SlidePuzzleDifficulty;
  initialProblem: SlidePuzzleGeneratedProblem;
};

function resolveSlidePuzzleReplayStart({
  difficulty,
  problemIdentity,
}: SlidePuzzleReplayConditions): RecordReplayStart<SlidePuzzleReplayStart> {
  // 評価の基準になる最短手数は問題集にしか無いので、問題集に無い問題は再プレイできない。
  const initialProblem = restoreSlidePuzzlePooledProblem(problemIdentity);
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return { status: "available", start: { difficulty, initialProblem } };
}

export const slidePuzzleCatalogEntry = {
  id: slidePuzzlePlayRecordDefinition.gameId,
  name: "スライドパズル",
  pictogramSvg,
  entryPath: "/puzzles/slide-puzzle",
  playRecordDisplay: slidePuzzlePlayRecordDisplay,
  ...createGameReplay({
    readRecordConditions(record) {
      return isSlidePuzzlePlayRecord(record) ? record.payload : null;
    },
    resolveStart: resolveSlidePuzzleReplayStart,
    renderPlay(start) {
      return <PlayableSlidePuzzle {...start} />;
    },
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveSlidePuzzleReplayStart };
