import {
  ArrowLeft,
  Home,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Trophy,
  Undo2,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
  type WaterSortDifficultyAssessment,
} from "@/games/water-sort/game/difficulty";
import type { WaterSortState } from "@/games/water-sort/game/state";
import type { WaterSortResult } from "@/games/water-sort/hooks/use-water-sort-game";
import { WaterSortBoard } from "@/games/water-sort/ui/WaterSortBoard";

type WaterSortPlayProps = {
  difficulty: WaterSortDifficulty;
  status: "playing" | "cleared";
  state: WaterSortState;
  problemDifficulty: WaterSortDifficultyAssessment;
  canUndo: boolean;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  result: WaterSortResult | null;
  selectBottle: (bottleIndex: number) => void;
  undo: () => void;
  restart: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function WaterSortPlay({
  difficulty,
  status,
  state,
  problemDifficulty,
  canUndo,
  sourceBottleIndex,
  selectableBottleIndexes,
  result,
  selectBottle,
  undo,
  restart,
  newGame,
  onChangeDifficulty,
  onBackToHome,
}: WaterSortPlayProps) {
  if (status === "cleared" && result) {
    return (
      <WaterSortResultScreen
        difficulty={difficulty}
        problemDifficulty={problemDifficulty}
        result={result}
        restart={restart}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex h-14 shrink-0 items-center justify-between px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="難易度選択へ戻る"
          onClick={onChangeDifficulty}
        >
          <ArrowLeft />
        </Button>
        <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {getWaterSortDifficultyLabel(difficulty)}
        </span>
        <PlayMenu
          restart={restart}
          newGame={newGame}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
        />
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          selectableBottleIndexes={selectableBottleIndexes}
          onSelectBottle={selectBottle}
        />
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-center px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-12 rounded-full border bg-background shadow-sm"
          aria-label="元に戻す"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 className="size-5" />
        </Button>
      </footer>
    </section>
  );
}

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  problemDifficulty: WaterSortDifficultyAssessment;
  result: WaterSortResult;
  restart: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

function WaterSortResultScreen({
  difficulty,
  problemDifficulty,
  result,
  restart,
  newGame,
  onChangeDifficulty,
  onBackToHome,
}: WaterSortResultScreenProps) {
  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-5">
        <div className="text-center">
          <ClearMark />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">クリア!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getWaterSortDifficultyLabel(difficulty)}
          </p>
        </div>

        <div className="mt-7 text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            スコア
          </p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-tight tabular-nums">
            {result.score}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              / 100
            </span>
          </p>
        </div>

        <dl className="mt-7 grid grid-cols-3 gap-2 text-center">
          <ResultMetric label="手数" value={String(result.moveCount)} />
          <ResultMetric label="最短" value={String(result.optimalMoveCount)} />
          <ResultMetric
            label="時間"
            value={formatElapsedTime(result.elapsedMs)}
          />
        </dl>

        <div className="mt-8 grid gap-3">
          <Button size="lg" className="h-12 text-base" onClick={newGame}>
            次の問題
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-base"
            onClick={restart}
          >
            <RefreshCw />
            もう一度
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onChangeDifficulty}>
            難易度を変える
          </Button>
          <Button variant="ghost" onClick={onBackToHome}>
            <Home />
            ホームへ
          </Button>
        </div>

        <details className="mt-6 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">
            プレイ詳細
          </summary>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <DetailMetric
              label="最短との差"
              value={formatMoveDelta(result.moveDelta)}
            />
            <DetailMetric label="元に戻す" value={`${result.undoCount}回`} />
            <DetailMetric label="やり直し" value={`${result.restartCount}回`} />
            <DetailMetric
              label="問題難易度"
              value={getWaterSortDifficultyLabel(problemDifficulty.difficulty)}
            />
          </dl>
        </details>
      </div>
    </section>
  );
}

function ClearMark() {
  const markRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRef.current?.animate?.(
      [
        { transform: "scale(0.65) rotate(-8deg)", opacity: 0 },
        { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, []);

  return (
    <div
      ref={markRef}
      className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-950/50 dark:text-amber-300"
      aria-hidden="true"
    >
      <Trophy className="size-9" />
    </div>
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
          className="absolute top-11 right-0 z-10 grid w-44 gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
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

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-2 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
