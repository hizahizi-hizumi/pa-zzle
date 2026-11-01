import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createHamiltonianPathDiagnosticSnapshot } from "@/games/hamiltonian-path/diagnostics";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import type { HamiltonianPathResult } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import type { HamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import { restoreHamiltonianPathProblem } from "@/games/hamiltonian-path/problem-selection";
import { HamiltonianPathDiagnostics } from "@/games/hamiltonian-path/ui/HamiltonianPathDiagnostics";
import { HamiltonianPathResultScreen } from "@/games/hamiltonian-path/ui/result/HamiltonianPathResultScreen";

type RecordedHamiltonianPathResultProps = RecordedGameResultProps<
  HamiltonianPathDifficulty,
  HamiltonianPathProblemIdentity,
  HamiltonianPathResult
>;

/** 記録から作り直したハミルトン路の結果画面。 */
export function RecordedHamiltonianPathResult(
  props: RecordedHamiltonianPathResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      // 検証情報は盤面を解き直して作るので、問題集から問題を探して作る。問題集に無い問題は検証情報を開かない。
      const pooled = restoreHamiltonianPathProblem(props.problemIdentity);
      return pooled
        ? createHamiltonianPathDiagnosticSnapshot({
            difficulty: props.difficulty,
            problemIdentity: props.problemIdentity,
            problem: pooled.problem,
            buildRevision,
          })
        : null;
    },
  );

  return (
    <>
      <HamiltonianPathResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <HamiltonianPathDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
