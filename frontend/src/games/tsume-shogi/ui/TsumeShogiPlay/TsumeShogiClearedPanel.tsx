import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { TsumeShogiSessionResult } from "@/games/tsume-shogi/session/session";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type TsumeShogiClearedPanelProps = {
  plies: number;
  result: TsumeShogiSessionResult;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function TsumeShogiClearedPanel({
  plies,
  result,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: TsumeShogiClearedPanelProps) {
  return (
    <section
      aria-label="詰み"
      className="mx-auto flex max-w-xl flex-col items-center gap-3 py-4"
    >
      <h2 className="text-xl font-semibold">詰み</h2>
      <p className="text-supporting text-muted-foreground">
        {plies}手詰 ・ {formatElapsedTime(result.elapsedMs)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={onStartNewProblem}>
          {PLAY_OPERATION_LABELS.startNewProblem}
        </Button>
        <Button type="button" variant="outline" onClick={onReplay}>
          {PLAY_OPERATION_LABELS.replay}
        </Button>
        <Button type="button" variant="ghost" onClick={onBackToHome}>
          ホーム
        </Button>
      </div>
    </section>
  );
}
