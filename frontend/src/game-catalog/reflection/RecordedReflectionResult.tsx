import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";

type RecordedReflectionResultProps = RecordedGameResultProps<
  ReflectionDifficulty,
  ReflectionProblemIdentity,
  ReflectionResult
>;

/** 記録から作り直したリフレクションの結果画面。 */
export function RecordedReflectionResult(props: RecordedReflectionResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      // 検証情報は問題集の中の位置から難易度分析を引くので、問題集から問題を探して作る。
      const pooled = restoreReflectionProblem(props.problemIdentity);
      return pooled
        ? createReflectionDiagnosticSnapshot({
            difficulty: props.difficulty,
            problemIdentity: props.problemIdentity,
            poolReference: pooled.poolReference,
            buildRevision,
          })
        : null;
    },
  );

  return (
    <>
      <ReflectionResultScreen
        {...screenProps}
        laserPathMode={reflectionLaserPathMode}
      />
      {diagnostics.snapshot && (
        <ReflectionDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
