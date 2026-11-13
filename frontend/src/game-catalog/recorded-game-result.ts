import type { RecordResultContext } from "@/game-catalog/game-catalog-entry";
import {
  type InternalDiagnosticsDialog,
  useInternalDiagnosticsDialog,
} from "@/game-catalog/internal-diagnostics-dialog";
import type { GamePlayResultScreenProps } from "@/games/play";
import { createProblemId, type ProblemIdentity } from "@/games/problem-id";

/** `Recorded<Game>Result` の props。 */
export type RecordedGameResultProps<Difficulty, Identity, Result> =
  RecordResultContext & {
    difficulty: Difficulty;
    problemIdentity: Identity;
    result: Result;
  };

export type RecordedGameResult<Difficulty, Result, Snapshot> = {
  screenProps: GamePlayResultScreenProps<Difficulty, Result>;
  diagnostics: InternalDiagnosticsDialog<Snapshot>;
};

export function useRecordedGameResult<
  Difficulty extends string,
  Identity extends ProblemIdentity,
  Result,
  Snapshot,
>(
  {
    difficulty,
    problemIdentity,
    result,
    recordFeedback,
    onReplay,
    navigation,
  }: RecordedGameResultProps<Difficulty, Identity, Result>,
  createDiagnosticSnapshot: (buildRevision: string | null) => Snapshot | null,
): RecordedGameResult<Difficulty, Result, Snapshot> {
  const diagnostics = useInternalDiagnosticsDialog(createDiagnosticSnapshot);

  function startNewProblem(): void {
    navigation.startNewProblem(difficulty, createProblemId(problemIdentity));
  }

  return {
    screenProps: {
      difficulty,
      result,
      recordFeedback,
      onReplay,
      onStartNewProblem: startNewProblem,
      onOpenGameHome() {
        navigation.openGameHome(createProblemId(problemIdentity));
      },
      onOpenDiagnostics: diagnostics.open,
    },
    diagnostics,
  };
}
