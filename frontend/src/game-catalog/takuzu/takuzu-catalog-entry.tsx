import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableTakuzu } from "@/game-catalog/takuzu/PlayableTakuzu";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { isTakuzuPlayAttempt } from "@/games/takuzu/play-attempt";
import {
  isTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import type { TakuzuRecordedProblemIdentity } from "@/games/takuzu/problem/problem";
import type { TakuzuPooledProblem } from "@/games/takuzu/problem/problem-pool";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";
import { takuzuPlayAttemptDisplay } from "@/games/takuzu/ui/play-attempt-display";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";

/** 完了記録と試行に共通する開始条件。 */
type TakuzuReplayConditions = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuRecordedProblemIdentity;
};

type TakuzuReplayStart = {
  difficulty: TakuzuDifficulty;
  initialProblem: TakuzuPooledProblem;
};

function resolveTakuzuReplayStart({
  difficulty,
  problemIdentity,
}: TakuzuReplayConditions): RecordReplayStart<TakuzuReplayStart> {
  // バイナリパズルは問題を問題集にしか持たないので、問題集から引けない記録は再プレイできない。
  const initialProblem = restoreTakuzuProblem(problemIdentity);
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return { status: "available", start: { difficulty, initialProblem } };
}

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: "バイナリパズル",
  pictogramSvg,
  entryPath: "/puzzles/takuzu",
  playRecordDisplay: takuzuPlayRecordDisplay,
  playAttemptDisplay: takuzuPlayAttemptDisplay,
  ...createGameReplay({
    readRecordConditions: (record) =>
      isTakuzuPlayRecord(record) ? record.payload : null,
    readAttemptConditions: (attempt) =>
      isTakuzuPlayAttempt(attempt) ? attempt.start : null,
    resolveStart: resolveTakuzuReplayStart,
    renderPlay: (start) => <PlayableTakuzu {...start} />,
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveTakuzuReplayStart };
