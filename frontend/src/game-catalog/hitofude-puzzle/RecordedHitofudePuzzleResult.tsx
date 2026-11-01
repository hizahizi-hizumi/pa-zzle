import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createHitofudePuzzleDiagnosticSnapshot } from "@/games/hitofude-puzzle/diagnostics";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import type { HitofudePuzzleResult } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleProblemIdentity } from "@/games/hitofude-puzzle/problem/problem";
import { restoreHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem-selection";
import { HitofudePuzzleDiagnostics } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDiagnostics";
import { HitofudePuzzleResultScreen } from "@/games/hitofude-puzzle/ui/result/HitofudePuzzleResultScreen";

type RecordedHitofudePuzzleResultProps = RecordedGameResultProps<
  HitofudePuzzleDifficulty,
  HitofudePuzzleProblemIdentity,
  HitofudePuzzleResult
>;

/** 記録から作り直した一筆パズルの結果画面。 */
export function RecordedHitofudePuzzleResult(
  props: RecordedHitofudePuzzleResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      // 検証情報は盤面を解き直して作るので、問題集から問題を探して作る。問題集に無い問題は検証情報を開かない。
      const pooled = restoreHitofudePuzzleProblem(props.problemIdentity);
      return pooled
        ? createHitofudePuzzleDiagnosticSnapshot({
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
      <HitofudePuzzleResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <HitofudePuzzleDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
