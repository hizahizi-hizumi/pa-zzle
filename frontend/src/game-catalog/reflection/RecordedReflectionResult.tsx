import { type ReactNode, useMemo, useState } from "react";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemId } from "@/games/problem-id";
import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import {
  getReflectionDifficultyLabel,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useNavigate } from "@/router";

type RecordedReflectionResultProps = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  result: ReflectionResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/** 記録から作り直したリフレクションの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedReflectionResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: RecordedReflectionResultProps) {
  const navigate = useNavigate();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  // 検証情報は問題を作り直して難易度分析を伴うので、開いたときだけ作る。
  const diagnostics = useMemo(
    () =>
      internalDiagnosticsAvailable && diagnosticsOpen
        ? createReflectionDiagnosticSnapshot({
            difficulty,
            problemIdentity,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, problemIdentity],
  );

  function startNewProblem() {
    navigate("/puzzles/reflection/play/:difficulty", {
      params: { difficulty },
      state: createPlayLocationState(createProblemId(problemIdentity)),
    });
  }

  return (
    <>
      <ReflectionResultScreen
        difficultyLabel={getReflectionDifficultyLabel(difficulty)}
        laserPathMode={reflectionLaserPathMode}
        performance={result}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
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
