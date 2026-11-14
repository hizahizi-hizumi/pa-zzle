import { useMemo } from "react";
import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { useGameNavigation } from "@/app/game-integration/game-navigation";
import {
  type InternalDiagnosticsDialog,
  useInternalDiagnosticsDialog,
} from "@/app/game-integration/internal-diagnostics-dialog";
import { usePlayScreenMusicState } from "@/app/game-integration/play-screen-music-state";
import { useResultRewardSound } from "@/app/game-integration/result-reward-sound";
import { useProblemIdQuerySync } from "@/app/navigation/problem-id-query";
import { useRecordResultNavigation } from "@/app/navigation/record-result-navigation";
import { usePlayAttemptRecord } from "@/features/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/features/records/hooks/use-save-play-record";
import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { createResultRecordFeedback } from "@/features/records/ui/result-record-feedback";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import type { GamePlay, GamePlayScreenProps } from "@/games/play";
import { createProblemId, type ProblemIdentity } from "@/games/problem-id";
import type { PlayScore, ScoreItem } from "@/games/score";

/** 結果画面と報酬の音が評価段階を決めるのに使う、プレイの評価点。 */
type ScoredResult = {
  score: Pick<PlayScore<ScoreItem>, "total">;
};

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
  Result extends ScoredResult,
  Snapshot,
> = {
  game: GameCatalogEntry;
  play: GamePlay<Difficulty, Identity, Session, Result>;
  playRecordDefinition: PlayRecordDefinition;
  /** 記録を作り直さないよう、描画ごとに作り直さない関数を渡す。 */
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
  screenProps: GamePlayScreenProps<Difficulty, Result>;
  diagnostics: InternalDiagnosticsDialog<Snapshot>;
};

export function usePlayableGame<
  Difficulty extends string,
  Identity extends ProblemIdentity,
  Session,
  Result extends ScoredResult,
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
  useResultRewardSound(play.progress, result?.score.total ?? null);
  usePlayScreenMusicState(
    play.progress,
    play.progress === "result" && result !== null && !navigatesToRecordResult,
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
      recordFeedback: createResultRecordFeedback(
        recordOutcome,
        game.playRecordDisplay,
      ),
      onReplay: play.replay,
      onClearAnimationComplete: play.completeClearAnimation,
      onStartNewProblem() {
        navigation.startNewProblem(
          difficulty,
          createProblemId(problemIdentity),
          { replacesHistory: true },
        );
      },
      // やめた問題のプレイ画面は、ブラウザの戻るで開き直さないよう履歴に残さない。
      onOpenGameHome() {
        navigation.openGameHome(createProblemId(problemIdentity), {
          replacesHistory: true,
        });
      },
      onBackToAppHome: navigation.backToAppHome,
      onOpenDiagnostics: diagnostics.open,
      renderSettingsDialog({ open, onClose }) {
        return (
          <SettingsDialog
            open={open}
            onOpenChange={(next) => {
              if (!next) onClose();
            }}
          />
        );
      },
    },
    diagnostics,
  };
}
