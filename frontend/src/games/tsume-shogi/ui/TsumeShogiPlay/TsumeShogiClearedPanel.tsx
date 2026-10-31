import { Button } from "@/components/ui/button";
import { getDifficultyLabel } from "@/games/difficulty";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiSessionResult } from "@/games/tsume-shogi/session/session";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type TsumeShogiClearedPanelProps = {
  difficulty: TsumeShogiDifficulty;
  plies: number;
  result: TsumeShogiSessionResult;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

/** 結果画面を導入するまで、詰み上がりの後に次の行動を置く仮表示。 */
export function TsumeShogiClearedPanel({
  difficulty,
  plies,
  result,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: TsumeShogiClearedPanelProps) {
  return (
    <section
      aria-label="詰み"
      className="mx-auto flex max-w-xl flex-col items-center gap-4 p-4"
    >
      <div className="flex flex-col items-center gap-1">
        <strong className="text-screen-title">詰み</strong>
        <span className="text-meta text-muted-foreground">
          {plies}手詰 ・ {getDifficultyLabel(difficulty)} ・{" "}
          {formatElapsedTime(result.elapsedMs)}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={onReplay}>
          {PLAY_OPERATION_LABELS.replay}
        </Button>
        <Button type="button" onClick={onStartNewProblem}>
          {PLAY_OPERATION_LABELS.startNewProblem}
        </Button>
        <Button type="button" variant="ghost" onClick={onBackToHome}>
          ホーム
        </Button>
      </div>
    </section>
  );
}
