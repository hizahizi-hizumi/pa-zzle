import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableNanpure } from "@/game-catalog/nanpure/PlayableNanpure";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import {
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import {
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import type { NanpureIdentifiedProblem } from "@/games/nanpure/problem/problem";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { nanpurePlayAttemptDisplay } from "@/games/nanpure/ui/play-attempt-display";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import type { PlayRecord } from "@/records/play-record";

type NanpureReplayStart = {
  difficulty: NanpureDifficulty;
  initialProblem: NanpureIdentifiedProblem;
};

function resolveNanpureReplayStart(
  record: PlayRecord,
): RecordReplayStart<NanpureReplayStart> {
  if (!isNanpurePlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  // 3段階の難易度で遊んだ記録はレベルへ読み替えないので再プレイできない。
  const difficulty = parseNanpureDifficulty(record.payload.difficulty);
  if (!difficulty) {
    return unavailableRecordReplay("legacy-difficulty");
  }

  // ナンプレは問題を問題集にしか持たないので、問題集から引けない記録は再プレイできない。
  const initialProblem = restoreNanpureProblem(record.payload.problemIdentity);
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
  replayRecord(record) {
    return renderRecordReplay(resolveNanpureReplayStart(record), (start) => (
      <PlayableNanpure {...start} />
    ));
  },
} satisfies GameCatalogEntry;

export const _private = { resolveNanpureReplayStart };
