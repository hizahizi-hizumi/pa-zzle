import {
  ArrowLeft,
  Home,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatElapsedTime } from "@/games/nanpure/ui/format-elapsed-time";

type NanpurePlayHeaderProps = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restart: () => void;
  startNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function NanpurePlayHeader({
  elapsedMs,
  mistakeCount,
  undoCount,
  restart,
  startNewProblem,
  onChangeDifficulty,
  onBackToHome,
}: NanpurePlayHeaderProps) {
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
      <PlayHeaderSummary
        elapsedMs={elapsedMs}
        mistakeCount={mistakeCount}
        undoCount={undoCount}
      />
      <PlayMenu
        restart={restart}
        startNewProblem={startNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    </header>
  );
}

function PlayHeaderSummary({
  elapsedMs,
  mistakeCount,
  undoCount,
}: {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
}) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-sm font-semibold tracking-tight">
        ナンプレ
      </h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] leading-none text-muted-foreground">
        <PlayMetric label="ミス" value={String(mistakeCount)} />
        <MetricSeparator />
        <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
        <MetricSeparator />
        <PlayMetric label="待った" value={String(undoCount)} />
      </div>
    </div>
  );
}

function PlayMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground/80">
        {value}
      </span>
    </span>
  );
}

function MetricSeparator() {
  return (
    <span aria-hidden="true" className="text-border">
      ·
    </span>
  );
}

type PlayMenuProps = {
  restart: () => void;
  startNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

function PlayMenu({
  restart,
  startNewProblem,
  onChangeDifficulty,
  onBackToHome,
}: PlayMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const runAndClose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
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
      {isOpen && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-20 grid w-44 gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <MenuButton
            icon={<RotateCcw />}
            label="最初から"
            onClick={() => runAndClose(restart)}
          />
          <MenuButton
            icon={<RefreshCw />}
            label="新しい問題"
            onClick={() => runAndClose(startNewProblem)}
          />
          <MenuButton
            label="難易度を変える"
            onClick={() => runAndClose(onChangeDifficulty)}
          />
          <MenuButton
            icon={<Home />}
            label="ホームへ"
            onClick={() => runAndClose(onBackToHome)}
          />
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
