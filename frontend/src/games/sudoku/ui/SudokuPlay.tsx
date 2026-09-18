import {
  ArrowLeft,
  Eraser,
  Home,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type { SudokuDifficulty } from "@/games/sudoku/game/difficulty";
import type { SudokuNotes } from "@/games/sudoku/game/session";
import {
  SUDOKU_DIGITS,
  SUDOKU_SIZE,
  type SudokuBoard as SudokuBoardState,
  type SudokuDigit,
} from "@/games/sudoku/game/state";
import type {
  SudokuProgress,
  SudokuResult,
} from "@/games/sudoku/hooks/use-sudoku-game";
import { SudokuBoard } from "@/games/sudoku/ui/board/SudokuBoard";
import { cn } from "@/lib/utils";

type SudokuPlayProps = {
  difficulty: SudokuDifficulty;
  status: "playing" | "cleared";
  progress: SudokuProgress;
  clues: SudokuBoardState;
  board: SudokuBoardState;
  notes: SudokuNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  notesMode: boolean;
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
  canUndo: boolean;
  result: SudokuResult | null;
  selectCell: (cellIndex: number) => void;
  inputDigit: (digit: SudokuDigit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
  undo: () => void;
  restart: () => void;
  replay: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  completeClearPresentation: () => void;
};

export function SudokuPlay({
  status,
  progress,
  clues,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  notesMode,
  elapsedMs,
  mistakeCount,
  undoCount,
  restartCount,
  canUndo,
  result,
  selectCell,
  inputDigit,
  erase,
  toggleNotesMode,
  undo,
  restart,
  replay,
  newGame,
  onChangeDifficulty,
  onBackToHome,
  completeClearPresentation,
}: SudokuPlayProps) {
  if (progress === "result" && status === "cleared" && result) {
    return (
      <SudokuResultScreen
        result={result}
        replay={replay}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    );
  }

  const interactionEnabled = status === "playing" && progress === "playing";
  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const selectedHasNotes =
    selectedCellIndex !== null && (notes[selectedCellIndex]?.length ?? 0) > 0;
  const canEnterDigit =
    interactionEnabled &&
    selectedIsEditable &&
    (!notesMode || !selectedHasAnswer);
  const mistakeCells = new Set(mistakeCellIndices);
  const completedDigits = new Set(
    SUDOKU_DIGITS.filter(
      (digit) =>
        board.filter(
          (cell, cellIndex) => cell === digit && !mistakeCells.has(cellIndex),
        ).length >= SUDOKU_SIZE,
    ),
  );

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
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
          newGame={newGame}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
        />
      </header>

      <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3">
        <SudokuClearMoment
          active={progress === "clearing"}
          onComplete={completeClearPresentation}
        >
          <SudokuBoard
            board={board}
            clues={clues}
            notes={notes}
            selectedCellIndex={selectedCellIndex}
            conflictCellIndices={conflictCellIndices}
            mistakeCellIndices={mistakeCellIndices}
            interactionDisabled={!interactionEnabled}
            onSelectCell={selectCell}
          />
        </SudokuClearMoment>
      </main>

      <footer className="shrink-0 px-3 pb-3 pt-2">
        <div className="mx-auto grid w-full max-w-xl gap-3">
          <div className="grid grid-cols-3">
            <PlayActionButton
              icon={<Undo2 />}
              label="待った"
              onClick={undo}
              disabled={!interactionEnabled || !canUndo}
            />
            <PlayActionButton
              icon={<Eraser />}
              label="消す"
              onClick={erase}
              disabled={
                !interactionEnabled ||
                !selectedIsEditable ||
                (!selectedHasAnswer && !selectedHasNotes)
              }
            />
            <PlayActionButton
              icon={<Pencil />}
              label="メモ"
              active={notesMode}
              onClick={toggleNotesMode}
              disabled={!interactionEnabled}
            />
          </div>
          <fieldset className="grid grid-cols-9">
            <legend className="sr-only">数字入力</legend>
            {SUDOKU_DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                className={cn(
                  "h-14 min-w-0 rounded-lg px-0 text-[clamp(1.5rem,7vw,2.25rem)] tabular-nums transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/20",
                  notesMode
                    ? "font-medium text-violet-400/75 dark:text-violet-400/70"
                    : "font-medium text-violet-600 dark:text-violet-300",
                )}
                onClick={() => inputDigit(digit)}
                disabled={!canEnterDigit || completedDigits.has(digit)}
              >
                {digit}
              </button>
            ))}
          </fieldset>
        </div>
      </footer>
    </section>
  );
}

function SudokuClearMoment({
  active,
  onComplete,
  children,
}: {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onComplete();
      return;
    }

    const animation = containerRef.current?.animate?.(
      [
        { transform: "scale(1)", filter: "saturate(1)" },
        {
          transform: "scale(1.012)",
          filter: "saturate(1.18)",
          offset: 0.55,
        },
        { transform: "scale(1)", filter: "saturate(1)" },
      ],
      { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" },
    );

    if (!animation) {
      const timer = window.setTimeout(onComplete, 460);
      return () => window.clearTimeout(timer);
    }

    animation.onfinish = onComplete;
    return () => animation.cancel();
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-violet-200/15 dark:bg-violet-700/10"
        />
      )}
    </div>
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

function PlayActionButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active || undefined}
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35",
        active &&
          "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true" className="[&>svg]:size-6">
        {icon}
      </span>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  );
}

type PlayMenuProps = {
  restart: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

function PlayMenu({
  restart,
  newGame,
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
            onClick={() => runAndClose(newGame)}
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

function SudokuResultScreen({
  result,
  replay,
  newGame,
  onChangeDifficulty,
  onBackToHome,
}: {
  result: SudokuResult;
  replay: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
}) {
  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <BrandIdentityHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-semibold text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300">
          ✓
        </div>
        <p className="mt-4 text-sm font-semibold">ナンプレ</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">クリア</h1>

        <dl className="mt-6 grid grid-cols-2 gap-2">
          <ResultMetric
            label="時間"
            value={formatElapsedTime(result.elapsedMs)}
          />
          <ResultMetric label="ミス" value={String(result.mistakeCount)} />
          <ResultMetric label="待った" value={String(result.undoCount)} />
          <ResultMetric label="やり直し" value={String(result.restartCount)} />
        </dl>

        <div className="mt-6 grid gap-2">
          <Button type="button" size="lg" onClick={newGame}>
            新しい問題
          </Button>
          <Button type="button" variant="outline" onClick={replay}>
            同じ問題をもう一度
          </Button>
          <Button type="button" variant="ghost" onClick={onChangeDifficulty}>
            難易度を変える
          </Button>
          <Button type="button" variant="ghost" onClick={onBackToHome}>
            ホームへ
          </Button>
        </div>

        <details className="mt-5 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer text-center">問題情報</summary>
          <dl className="mt-3 grid gap-1 rounded-lg bg-muted/50 px-3 py-2">
            <DetailMetric label="seed" value={result.problemIdentity.seed} />
            <DetailMetric
              label="generator"
              value={result.problemIdentity.generatorVersion}
            />
            <DetailMetric
              label="clues"
              value={String(result.problemIdentity.conditions.clueCount)}
            />
          </dl>
        </details>
      </div>
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-2 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="break-all font-mono text-foreground">{value}</dd>
    </div>
  );
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
