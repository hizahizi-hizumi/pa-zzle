import { Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { BrowserBottomSurface } from "@/components/BrowserBottomSurface";
import { GameResultActions } from "@/components/GameResultScreen/GameResultActions";
import {
  GameResultDetails,
  type GameResultScoreCriteria,
} from "@/components/GameResultScreen/GameResultDetails";
import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import { GameResultMetrics } from "@/components/GameResultScreen/GameResultMetrics";
import { GameResultMoment } from "@/components/GameResultScreen/GameResultMoment";
import { GameResultRecordNotice } from "@/components/GameResultScreen/GameResultRecordNotice";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import { Button } from "@/components/ui/button";
import type { ResultRecordFeedback } from "@/games/play";
import { getGameResultLevel } from "@/games/result";
import "@/components/GameResultScreen.css";

export type { GameResultScoreCriteria };

type GameResultScreenProps = {
  gameName: string;
  difficultyLabel: string;
  score: number;
  metrics:
    | readonly [GameResultMetric, GameResultMetric]
    | readonly [GameResultMetric, GameResultMetric, GameResultMetric];
  recordFeedback: ResultRecordFeedback;
  scoreBreakdown: readonly GameResultDetailMetric[];
  scoreCriteria: GameResultScoreCriteria;
  onStartNewProblem: () => void;
  onReplay?: () => void;
  onOpenGameHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function GameResultScreen({
  gameName,
  difficultyLabel,
  score,
  metrics,
  recordFeedback,
  scoreBreakdown,
  scoreCriteria,
  onStartNewProblem,
  onReplay,
  onOpenGameHome,
  onOpenDiagnostics,
}: GameResultScreenProps) {
  const screenRef = useRef<HTMLElement>(null);
  const [skipReveal, setSkipReveal] = useState(false);
  const level = getGameResultLevel(score);
  const improvements =
    recordFeedback.kind === "updated" ? recordFeedback.improvements : [];

  useEffect(() => {
    screenRef.current?.focus({ preventScroll: true });
  }, []);

  function finishReveal(element: HTMLDivElement) {
    for (const animation of element.getAnimations?.({ subtree: true }) ?? []) {
      if (animation.playState === "running") animation.finish();
    }
    setSkipReveal(true);
  }

  return (
    <section
      ref={screenRef}
      tabIndex={-1}
      aria-label="プレイ結果"
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-y-auto bg-background outline-none"
    >
      <BrandIdentityHeader linkToHome pinned />
      <h1 className="sr-only">プレイ結果</h1>
      <div
        className="result-screen"
        data-level={level}
        onPointerDown={(event) => finishReveal(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            finishReveal(event.currentTarget);
        }}
      >
        <header className="result-quiet-heading">
          <div className="result-quiet-context">
            <span className="result-quiet-game">{gameName}</span>
            <span>{difficultyLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <GameResultDetails
              breakdown={scoreBreakdown}
              criteria={scoreCriteria}
            />
            {onOpenDiagnostics && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="検証情報"
                onClick={onOpenDiagnostics}
              >
                <Wrench aria-hidden="true" />
              </Button>
            )}
          </div>
        </header>
        <div className="result-quiet-metrics">
          <GameResultMetrics metrics={metrics} improvements={improvements} />
        </div>
        <main className="result-quiet-moment">
          <GameResultMoment
            level={level}
            score={score}
            skipReveal={skipReveal}
            improvement={improvements.find((item) => item.id === "play-score")}
          />
        </main>
        <div className="result-quiet-feedback">
          <GameResultRecordNotice feedback={recordFeedback} />
        </div>
        <footer className="result-quiet-footer">
          <GameResultActions
            onStartNewProblem={onStartNewProblem}
            onOpenGameHome={onOpenGameHome}
            onReplay={onReplay}
          />
        </footer>
      </div>
      <BrowserBottomSurface surface="brand" />
    </section>
  );
}
