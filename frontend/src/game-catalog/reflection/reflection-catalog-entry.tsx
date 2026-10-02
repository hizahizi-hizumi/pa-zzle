import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableReflection } from "@/game-catalog/reflection/PlayableReflection";
import pictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  isReflectionPlayRecord,
  reflectionPlayRecordDefinition,
} from "@/games/reflection/play-record";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";
import type { PlayRecord } from "@/records/play-record";

type ReflectionReplayStart = {
  difficulty: ReflectionDifficulty;
  initialProblem: {
    identity: ReflectionProblemIdentity;
  };
};

function resolveReflectionReplayStart(
  record: PlayRecord,
): RecordReplayStart<ReflectionReplayStart> {
  if (!isReflectionPlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  // 評価の基準時間に使う作業の量は問題集にしか無いので、問題集に無い問題は再プレイできない。
  const restored = restoreReflectionProblem(record.payload.problemIdentity);
  if (!restored) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return {
    status: "available",
    start: {
      difficulty: record.payload.difficulty,
      initialProblem: { identity: restored.identity },
    },
  };
}

export const reflectionCatalogEntry = {
  id: reflectionPlayRecordDefinition.gameId,
  name: REFLECTION_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/reflection",
  playRecordDisplay: reflectionPlayRecordDisplay,
  replayRecord(record) {
    return renderRecordReplay(resolveReflectionReplayStart(record), (start) => (
      <PlayableReflection {...start} />
    ));
  },
} satisfies GameCatalogEntry;

export const _private = { resolveReflectionReplayStart };
