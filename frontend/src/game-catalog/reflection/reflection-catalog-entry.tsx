import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
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
import type { ReflectionRecordedProblemIdentity } from "@/games/reflection/problem/problem";
import type { ReflectionPooledProblem } from "@/games/reflection/problem/problem-pool";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";

/** 完了記録の開始条件。 */
type ReflectionReplayConditions = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionRecordedProblemIdentity;
};

type ReflectionReplayStart = {
  difficulty: ReflectionDifficulty;
  initialProblem: {
    restored: ReflectionPooledProblem;
  };
};

function resolveReflectionReplayStart({
  difficulty,
  problemIdentity,
}: ReflectionReplayConditions): RecordReplayStart<ReflectionReplayStart> {
  // 評価の基準時間に使う作業の量は問題集にしか無いので、問題集に無い問題は再プレイできない。
  const restored = restoreReflectionProblem(problemIdentity);
  if (!restored) {
    return unavailableRecordReplay("problem-not-in-pool");
  }

  return {
    status: "available",
    start: { difficulty, initialProblem: { restored } },
  };
}

export const reflectionCatalogEntry = {
  id: reflectionPlayRecordDefinition.gameId,
  name: REFLECTION_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/reflection",
  playRecordDisplay: reflectionPlayRecordDisplay,
  ...createGameReplay({
    readRecordConditions(record) {
      return isReflectionPlayRecord(record) ? record.payload : null;
    },
    resolveStart: resolveReflectionReplayStart,
    renderPlay(start) {
      return <PlayableReflection {...start} />;
    },
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveReflectionReplayStart };
