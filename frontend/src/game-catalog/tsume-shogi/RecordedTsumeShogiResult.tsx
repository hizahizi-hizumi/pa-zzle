import { type ReactNode, useMemo, useState } from "react";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemId } from "@/games/problem-id";
import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { restoreTsumeShogiProblem } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useNavigate } from "@/router";

type RecordedTsumeShogiResultProps = {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiProblemIdentity;
  result: TsumeShogiResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/** 記録から作り直した詰将棋の結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedTsumeShogiResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: RecordedTsumeShogiResultProps) {
  const navigate = useNavigate();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  // 検証情報は問題集の位置と局面を要るので、開いたときだけ問題集から問題を探して作る。
  const diagnostics = useMemo(() => {
    if (!internalDiagnosticsAvailable || !diagnosticsOpen) return null;
    const pooled = restoreTsumeShogiProblem(problemIdentity);
    return pooled
      ? createTsumeShogiDiagnosticSnapshot({
          difficulty,
          problemIdentity,
          poolReference: pooled.poolReference,
          problem: pooled.problem,
          buildRevision,
        })
      : null;
  }, [difficulty, diagnosticsOpen, problemIdentity]);

  function startNewProblem() {
    navigate("/puzzles/tsume-shogi/play/:difficulty", {
      params: { difficulty },
      state: createPlayLocationState(createProblemId(problemIdentity)),
    });
  }

  return (
    <>
      <TsumeShogiResultScreen
        difficultyLabel={getTsumeShogiDifficultyLabel(difficulty)}
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
        <TsumeShogiDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
