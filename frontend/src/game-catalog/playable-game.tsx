import { useMemo } from "react";

import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { useGameNavigation } from "@/game-catalog/game-navigation";
import {
  type InternalDiagnosticsDialog,
  useInternalDiagnosticsDialog,
} from "@/game-catalog/internal-diagnostics-dialog";
import { useProblemIdQuerySync } from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import type { GamePlay, GamePlayScreenProps } from "@/games/play";
import type { ProblemIdentity } from "@/games/problem-id";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import type { PlayAttemptProgress } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

/** クリアした1回のプレイ。完了記録の元になる。 */
export type CompletedGamePlay<Difficulty, Identity, Result> = {
  difficulty: Difficulty;
  problemIdentity: Identity;
  startedAt: number;
  completedAt: number;
  result: Result;
};

type PlayableGameSource<
  Difficulty extends string,
  Identity extends ProblemIdentity,
  Session,
  Result,
  Snapshot,
> = {
  game: Pick<GameCatalogEntry, "entryPath" | "playPath" | "playRecordDisplay">;
  play: GamePlay<Difficulty, Identity, Session, Result>;
  playRecordDefinition: PlayRecordDefinition;
  /** クリアしたプレイの完了記録を作る。記録を作り直さないよう、描画ごとに作り直さない関数を渡す。 */
  createPlayRecord: (
    completed: CompletedGamePlay<Difficulty, Identity, Result>,
  ) => PlayRecord;
  createPlayAttemptProgress: (
    session: Session,
    abandonedAt: number,
  ) => PlayAttemptProgress;
  createDiagnosticSnapshot: (buildRevision: string | null) => Snapshot | null;
};

export type PlayableGame<Difficulty, Result, Snapshot> = {
  /** プレイ画面 `<Game>Play` へそのまま渡す、進行・結果・遷移・検証情報の共通の props。 */
  screenProps: GamePlayScreenProps<Difficulty, Result>;
  diagnostics: InternalDiagnosticsDialog<Snapshot>;
};

/**
 * 1問のプレイを、URL の問題 ID・完了記録の保存と記録の結果画面への遷移・離脱の記録・画面遷移・検証情報へつなぐ。
 * 記録を保存できたクリアは記録の結果画面へ移すので、その間はその場の結果画面を出さない（`result` を `null` にする）。
 */
export function usePlayableGame<
  Difficulty extends string,
  Identity extends ProblemIdentity,
  Session,
  Result,
  Snapshot,
>({
  game,
  play,
  playRecordDefinition,
  createPlayRecord,
  createPlayAttemptProgress,
  createDiagnosticSnapshot,
}: PlayableGameSource<
  Difficulty,
  Identity,
  Session,
  Result,
  Snapshot
>): PlayableGame<Difficulty, Result, Snapshot> {
  const { difficulty, problemIdentity, startedAt, completedAt, result } = play;
  useProblemIdQuerySync(problemIdentity);
  const playRecord = useMemo(
    () =>
      result !== null && completedAt !== null
        ? createPlayRecord({
            difficulty,
            problemIdentity,
            startedAt,
            completedAt,
            result,
          })
        : null,
    [
      createPlayRecord,
      difficulty,
      problemIdentity,
      startedAt,
      completedAt,
      result,
    ],
  );
  const recordOutcome = useSavePlayRecord(playRecord, playRecordDefinition);
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  usePlayAttemptRecord({
    gameId: playRecordDefinition.gameId,
    startedAt,
    start: { difficulty, problemIdentity },
    finished: completedAt !== null,
    getProgress(abandonedAt) {
      return createPlayAttemptProgress(play.session, abandonedAt);
    },
  });
  const navigation = useGameNavigation(game);
  const diagnostics = useInternalDiagnosticsDialog(createDiagnosticSnapshot);

  return {
    screenProps: {
      difficulty,
      progress: play.progress,
      elapsedMs: play.elapsedMs,
      result: navigatesToRecordResult ? null : result,
      recordOutcomeNotice: (
        <PlayRecordOutcomeNotice
          outcome={recordOutcome}
          display={game.playRecordDisplay}
        />
      ),
      onReplay: play.replay,
      onStartNewProblem: play.startNewProblem,
      onOpenRecords: navigation.openRecords,
      onChangeDifficulty: navigation.changeDifficulty,
      onBackToHome: navigation.backToHome,
      onOpenDiagnostics: diagnostics.open,
    },
    diagnostics,
  };
}
