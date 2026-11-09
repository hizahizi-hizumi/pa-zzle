import { PlayHeaderSummary } from "@/components/PlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/components/PlayHeader/PlayMenu";
import { PuzzleBackIcon } from "@/components/PuzzleBackIcon";
import type { PlayHeaderMetric } from "@/components/play-header-metric";
import { Button } from "@/components/ui/button";

type PlayHeaderProps = {
  title: string;
  /** 2つまでは常に1行に並べる。3つ以上は、1行に収まらない幅で前から2つずつ行を分ける。 */
  metrics: readonly PlayHeaderMetric[];
  /** 省略するとメニューに「盤面を戻す」を出さない。 */
  onRestart?: () => void;
  canRestart?: boolean;
  /** 省略するとメニューに「リセット」を出さない。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  /** ゲームのホームへ移る。見出しの戻るとメニューから。 */
  onOpenGameHome: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay?: () => void;
  /** 省略するとメニューに「チュートリアル」を出さない。 */
  onOpenTutorial?: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayHeader({
  title,
  metrics,
  onRestart,
  canRestart = true,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
}: PlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="問題選択へ戻る"
        onClick={onOpenGameHome}
      >
        <PuzzleBackIcon />
      </Button>
      <PlayHeaderSummary title={title} metrics={metrics} />
      <PlayMenu
        onRestart={onRestart}
        canRestart={canRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onOpenGameHome={onOpenGameHome}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={onOpenHowToPlay}
        onOpenTutorial={onOpenTutorial}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    </header>
  );
}
