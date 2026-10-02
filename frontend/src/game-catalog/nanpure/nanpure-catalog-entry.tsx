import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableNanpure } from "@/game-catalog/nanpure/PlayableNanpure";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import {
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { isNanpurePlayAttempt } from "@/games/nanpure/play-attempt";
import {
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import type {
  NanpureIdentifiedProblem,
  NanpureRecordedProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { nanpurePlayAttemptDisplay } from "@/games/nanpure/ui/play-attempt-display";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";

/** 完了記録と試行に共通する開始条件。完了記録には3段階の難易度で遊んだものもある。 */
type NanpureReplayConditions = {
  difficulty: string;
  problemIdentity: NanpureRecordedProblemIdentity;
};

type NanpureReplayStart = {
  difficulty: NanpureDifficulty;
  initialProblem: NanpureIdentifiedProblem;
};

function resolveNanpureReplayStart({
  difficulty: recordedDifficulty,
  problemIdentity,
}: NanpureReplayConditions): RecordReplayStart<NanpureReplayStart> {
  // 3段階の難易度で遊んだ記録はレベルへ読み替えないので再プレイできない。
  const difficulty = parseNanpureDifficulty(recordedDifficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

  // ナンプレは問題を問題集にしか持たないので、問題集から引けない記録は再プレイできない。
  const initialProblem = restoreNanpureProblem(problemIdentity);
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return { status: "available", start: { difficulty, initialProblem } };
}

export const nanpureCatalogEntry = {
  id: nanpurePlayRecordDefinition.gameId,
  name: "ナンプレ",
  pictogramSvg,
  entryPath: "/puzzles/nanpure",
  playRecordDisplay: nanpurePlayRecordDisplay,
  playAttemptDisplay: nanpurePlayAttemptDisplay,
  ...createGameReplay({
    readRecordConditions: (record) =>
      isNanpurePlayRecord(record) ? record.payload : null,
    readAttemptConditions: (attempt) =>
      isNanpurePlayAttempt(attempt) ? attempt.start : null,
    resolveStart: resolveNanpureReplayStart,
    renderPlay: (start) => <PlayableNanpure {...start} />,
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveNanpureReplayStart };
