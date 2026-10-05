import { type ReactNode, useMemo, useState } from "react";
import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { getDifficultyLabel } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedReflectionResultProps = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  result: ReflectionResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したリフレクションの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedReflectionResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedReflectionResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  // 検証情報は問題集の中の位置から難易度分析を引くので、開いたときだけ問題集から問題を探して作る。
  const diagnostics = useMemo(() => {
    if (!internalDiagnosticsAvailable || !diagnosticsOpen) return null;
    const pooled = restoreReflectionProblem(problemIdentity);
    return pooled
      ? createReflectionDiagnosticSnapshot({
          difficulty,
          problemIdentity,
          poolReference: pooled.poolReference,
          buildRevision,
        })
      : null;
  }, [difficulty, diagnosticsOpen, problemIdentity]);

  function startNewProblem() {
    navigation.startNewProblem(difficulty, createProblemId(problemIdentity));
  }

  return (
    <>
      <ReflectionResultScreen
        difficultyLabel={getDifficultyLabel(difficulty)}
        laserPathMode={reflectionLaserPathMode}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={navigation.openRecords}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
        onOpenDiagnostics={
          internalDiagnosticsAvailable
            ? () => setDiagnosticsOpen(true)
            : undefined
        }
      />
      {diagnostics && (
        <ReflectionDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
