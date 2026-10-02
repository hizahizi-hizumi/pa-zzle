import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableTakuzu } from "@/game-catalog/takuzu/PlayableTakuzu";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  isTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import type { TakuzuPooledProblem } from "@/games/takuzu/problem/problem-pool";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";
import { takuzuPlayAttemptDisplay } from "@/games/takuzu/ui/play-attempt-display";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import type { PlayRecord } from "@/records/play-record";

type TakuzuReplayStart = {
  difficulty: TakuzuDifficulty;
  initialProblem: TakuzuPooledProblem;
};

function resolveTakuzuReplayStart(
  record: PlayRecord,
): RecordReplayStart<TakuzuReplayStart> {
  if (!isTakuzuPlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  // バイナリパズルは問題を問題集にしか持たないので、問題集から引けない記録は再プレイできない。
  const initialProblem = restoreTakuzuProblem(record.payload.problemIdentity);
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return {
    status: "available",
    start: { difficulty: record.payload.difficulty, initialProblem },
  };
}

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: "バイナリパズル",
  pictogramSvg,
  entryPath: "/puzzles/takuzu",
  playRecordDisplay: takuzuPlayRecordDisplay,
  playAttemptDisplay: takuzuPlayAttemptDisplay,
  replayRecord(record) {
    return renderRecordReplay(resolveTakuzuReplayStart(record), (start) => (
      <PlayableTakuzu {...start} />
    ));
  },
} satisfies GameCatalogEntry;

export const _private = { resolveTakuzuReplayStart };
