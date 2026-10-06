import type { RecordResultContext } from "@/game-catalog/game-catalog-entry";
import {
  type InternalDiagnosticsDialog,
  useInternalDiagnosticsDialog,
} from "@/game-catalog/internal-diagnostics-dialog";
import type { GamePlayResultScreenProps } from "@/games/play";
import { createProblemId, type ProblemIdentity } from "@/games/problem-id";

/** 記録から作り直した結果と、ゲームの外側が渡す告知と操作。`Recorded<Game>Result` の props。 */
export type RecordedGameResultProps<Difficulty, Identity, Result> =
  RecordResultContext & {
    difficulty: Difficulty;
    problemIdentity: Identity;
    result: Result;
  };

export type RecordedGameResult<Difficulty, Result, Snapshot> = {
  /** 結果画面 `<Game>ResultScreen` へそのまま渡す props。 */
  screenProps: GamePlayResultScreenProps<Difficulty, Result>;
  diagnostics: InternalDiagnosticsDialog<Snapshot>;
};

/**
 * 記録から作り直した結果を、結果画面の操作と検証情報へつなぐ。
 * 次の問題は記録と同じ難易度で、記録の問題を避けて始める。
 */
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
    recordOutcomeNotice,
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
      recordOutcomeNotice,
      onReplay,
      onStartNewProblem: startNewProblem,
      onOpenRecords: navigation.openRecords,
      onChangeDifficulty: navigation.changeDifficulty,
      onBackToHome: navigation.backToHome,
      onOpenDiagnostics: diagnostics.open,
    },
    diagnostics,
  };
}
