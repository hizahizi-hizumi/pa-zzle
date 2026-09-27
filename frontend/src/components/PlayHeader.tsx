import {
  ArrowLeft,
  Home,
  MoreHorizontal,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type PlayHeaderMetric = { label: string; value: string };

type PlayHeaderProps = {
  title: string;
  metrics: readonly PlayHeaderMetric[];
  canRestart: boolean;
  onRestart: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayHeader({
  title,
  metrics,
  canRestart,
  onRestart,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: PlayHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  function runAndClose(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-play-context">{title}</h1>
        <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
          {metrics.map((metric, index) => (
            <span key={metric.label} className="contents">
              {index > 0 ? (
                <span aria-hidden="true" className="text-border">
                  ·
                </span>
              ) : null}
              <span className="flex items-baseline gap-1 whitespace-nowrap">
                <span>{metric.label}</span>
                <span className="font-mono font-medium tabular-nums text-foreground/80">
                  {metric.value}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="その他の操作"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <MoreHorizontal />
        </Button>
        {isOpen ? (
          <div
            role="menu"
            className="absolute top-11 right-0 z-40 grid w-44 gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
          >
            <Button
              variant="ghost"
              className="justify-start"
              disabled={!canRestart}
              onClick={() => runAndClose(onRestart)}
            >
              <RotateCcw />
              盤面を戻す
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => runAndClose(onStartNewProblem)}
            >
              <Play />
              別の問題
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => runAndClose(onChangeDifficulty)}
            >
              <SlidersHorizontal />
              難易度変更
            </Button>
            {onOpenDiagnostics ? (
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => runAndClose(onOpenDiagnostics)}
              >
                <Wrench />
                検証情報
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => runAndClose(onBackToHome)}
            >
              <Home />
              ホーム
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
