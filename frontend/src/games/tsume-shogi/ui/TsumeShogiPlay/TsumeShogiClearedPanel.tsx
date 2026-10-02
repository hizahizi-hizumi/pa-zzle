import { Button } from "@/components/ui/button";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type TsumeShogiClearedPanelProps = {
  plies: number;
  elapsedMs: number;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function TsumeShogiClearedPanel({
  plies,
  elapsedMs,
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
        {plies}手詰 ・ {formatElapsedTime(elapsedMs)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={onStartNewProblem}>
          別の問題
        </Button>
        <Button type="button" variant="outline" onClick={onReplay}>
          もう一度
        </Button>
        <Button type="button" variant="ghost" onClick={onBackToHome}>
          ホーム
        </Button>
      </div>
    </section>
  );
}
