import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { isSlidePuzzlePlayAttempt } from "@/games/slide-puzzle/play-attempt";
import {
  isSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import type {
  SlidePuzzleGeneratedProblem,
  SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayAttemptDisplay } from "@/games/slide-puzzle/ui/play-attempt-display";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";

/** 完了記録と試行に共通する開始条件。 */
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
  playAttemptDisplay: slidePuzzlePlayAttemptDisplay,
  ...createGameReplay({
    readRecordConditions: (record) =>
      isSlidePuzzlePlayRecord(record) ? record.payload : null,
    readAttemptConditions: (attempt) =>
      isSlidePuzzlePlayAttempt(attempt) ? attempt.start : null,
    resolveStart: resolveSlidePuzzleReplayStart,
    renderPlay: (start) => <PlayableSlidePuzzle {...start} />,
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveSlidePuzzleReplayStart };
