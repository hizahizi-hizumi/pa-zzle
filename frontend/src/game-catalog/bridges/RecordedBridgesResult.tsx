import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createBridgesDiagnosticSnapshot } from "@/games/bridges/diagnostics";
import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import type { BridgesProblemIdentity } from "@/games/bridges/problem/problem";
import { restoreBridgesProblem } from "@/games/bridges/problem-selection";
import { BridgesDiagnostics } from "@/games/bridges/ui/BridgesDiagnostics";
import { BridgesResultScreen } from "@/games/bridges/ui/result/BridgesResultScreen";

type RecordedBridgesResultProps = RecordedGameResultProps<
  BridgesDifficulty,
  BridgesProblemIdentity,
  BridgesResult
>;

export function RecordedBridgesResult(props: RecordedBridgesResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      // 検証情報は盤面を解き直して作るので、問題集から問題を探して作る。問題集に無い問題は検証情報を開かない。
      const pooled = restoreBridgesProblem(props.problemIdentity);
      return pooled
        ? createBridgesDiagnosticSnapshot({
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
      <BridgesResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <BridgesDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
