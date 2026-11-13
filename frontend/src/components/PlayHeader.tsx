import type { ReactNode } from "react";

import { PlayHeaderSummary } from "@/components/PlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/components/PlayHeader/PlayMenu";
import { PuzzleBackIcon } from "@/components/PuzzleBackIcon";
import type { PlayHeaderMetric } from "@/components/play-header-metric";
import { Button } from "@/components/ui/button";

type PlayHeaderProps = {
  title: string;
  /** 2つまでは常に1行に並べる。3つ以上は、1行に収まらない幅で前から2つずつ行を分ける。 */
  metrics: readonly PlayHeaderMetric[];
  /** 渡すと、`null` で一時的に隠す間も見出しが動かないよう、両端の幅を広げて確保する。 */
  trailingAction?: ReactNode;
  onRestart?: () => void;
  canRestart?: boolean;
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  onBackToAppHome: () => void;
  onOpenHowToPlay?: () => void;
  onOpenTutorial?: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayHeader({
  title,
  metrics,
  trailingAction,
  onRestart,
  canRestart = true,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
}: PlayHeaderProps) {
  const hasTrailingAction = trailingAction !== undefined;
  const menu = (
    <PlayMenu
      onRestart={onRestart}
      canRestart={canRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenTutorial={onOpenTutorial}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );

  return (
    <header
      className={
        hasTrailingAction
          ? "grid h-[4.5rem] shrink-0 grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-start px-3 pt-2"
          : "grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start px-3 pt-2"
      }
    >
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
      {hasTrailingAction ? (
        <div className="flex justify-end gap-1">
          {trailingAction}
          {menu}
        </div>
      ) : (
        menu
      )}
    </header>
  );
}
