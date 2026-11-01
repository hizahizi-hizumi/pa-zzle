import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import type { TsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { restoreTsumeShogiProblem } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";

type RecordedTsumeShogiResultProps = RecordedGameResultProps<
  TsumeShogiDifficulty,
  TsumeShogiProblemIdentity,
  TsumeShogiResult
>;

/** 記録から作り直した詰将棋の結果画面。 */
export function RecordedTsumeShogiResult(props: RecordedTsumeShogiResultProps) {
  // 結果は記録だけで描ける。検証情報は問題集の位置と局面を要るので、問題集の本体を読み込んでから問題を探して作る。
  const problemPoolStatus = useTsumeShogiProblemPool();
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      if (problemPoolStatus !== "loaded") return null;
      const pooled = restoreTsumeShogiProblem(props.problemIdentity);
      return pooled
        ? createTsumeShogiDiagnosticSnapshot({
            difficulty: props.difficulty,
            problemIdentity: props.problemIdentity,
            poolReference: pooled.poolReference,
            problem: pooled.problem,
            buildRevision,
          })
        : null;
    },
  );

  return (
    <>
      <TsumeShogiResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <TsumeShogiDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
