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
import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type { SudokuDifficulty } from "@/games/sudoku/game/difficulty";
import type { SudokuNotes } from "@/games/sudoku/game/session";
import {
  SUDOKU_DIGITS,
  type SudokuBoard as SudokuBoardState,
  type SudokuDigit,
} from "@/games/sudoku/game/state";
import type { SudokuResult } from "@/games/sudoku/hooks/use-sudoku-game";
import { SudokuBoard } from "@/games/sudoku/ui/board/SudokuBoard";

type SudokuPlayProps = {
  difficulty: SudokuDifficulty;
  status: "playing" | "cleared";
  clues: SudokuBoardState;
  board: SudokuBoardState;
  notes: SudokuNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
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
};

export function SudokuPlay({
  status,
  clues,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
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
}: SudokuPlayProps) {
  if (status === "cleared" && result) {
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

  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const canEnterDigit =
    selectedIsEditable && (!notesMode || !selectedHasAnswer);

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

      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-1 sm:px-6">
        <SudokuBoard
          board={board}
          clues={clues}
          notes={notes}
          selectedCellIndex={selectedCellIndex}
          conflictCellIndices={conflictCellIndices}
          onSelectCell={selectCell}
        />
      </main>

      <footer className="shrink-0 px-3 pb-2 pt-1">
        <div className="mx-auto grid w-full max-w-xl gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 />
              待った
            </Button>
            <Button
              type="button"
              variant={notesMode ? "secondary" : "ghost"}
              aria-pressed={notesMode}
              onClick={toggleNotesMode}
            >
              <Pencil />
              メモ
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={erase}
              disabled={!selectedIsEditable || !selectedHasAnswer}
            >
              <Eraser />
              消す
            </Button>
          </div>
          <fieldset className="grid grid-cols-9 gap-1">
            <legend className="sr-only">数字入力</legend>
            {SUDOKU_DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                className="h-11 min-w-0 rounded-md border bg-background px-0 text-lg font-semibold tabular-nums shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                onClick={() => inputDigit(digit)}
                disabled={!canEnterDigit}
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
        <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
        <MetricSeparator />
        <PlayMetric label="ミス" value={String(mistakeCount)} />
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
