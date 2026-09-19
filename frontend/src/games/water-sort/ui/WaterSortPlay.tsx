import {
  ArrowLeft,
  Home,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Undo2,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GamePictogram } from "@/components/GamePictogram";
import {
  GameResultConfetti,
  GameResultMark,
  GameResultScoreCard,
  getGameResultScorePresentation,
} from "@/components/GameResultPresentation";
import { Button } from "@/components/ui/button";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
  type WaterSortDifficultyAssessment,
} from "@/games/water-sort/difficulty";
import type {
  WaterSortOperation,
  WaterSortProgress,
  WaterSortResult,
} from "@/games/water-sort/hooks/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import type { PlayRecordSaveOutcome } from "@/records/presentation";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

type WaterSortPlayProps = {
  difficulty: WaterSortDifficulty;
  status: "playing" | "cleared";
  progress: WaterSortProgress;
  state: WaterSortState;
  problemDifficulty: WaterSortDifficultyAssessment;
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  canUndo: boolean;
  isDeadlocked: boolean;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  result: WaterSortResult | null;
  recordOutcome: PlayRecordSaveOutcome | null;
  selectBottle: (bottleIndex: number) => void;
  undo: () => void;
  restart: () => void;
  replay: () => void;
  startNewProblem: () => void;
  onOpenRecords: () => void;
  completeClearingPour: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortPlay({
  difficulty,
  status,
  progress,
  state,
  problemDifficulty,
  elapsedMs,
  moveCount,
  undoCount,
  canUndo,
  isDeadlocked,
  sourceBottleIndex,
  operation,
  result,
  recordOutcome,
  selectBottle,
  undo,
  restart,
  replay,
  startNewProblem,
  onOpenRecords,
  completeClearingPour,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortPlayProps) {
  const [hasActivePourAnimation, setHasActivePourAnimation] = useState(false);
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;

  if (progress === "result" && status === "cleared" && result) {
    return (
      <WaterSortResultScreen
        difficulty={difficulty}
        problemDifficulty={problemDifficulty}
        result={result}
        recordOutcome={recordOutcome}
        replay={replay}
        startNewProblem={startNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

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
          moveCount={moveCount}
          undoCount={undoCount}
        />
        <PlayMenu
          restart={restart}
          startNewProblem={startNewProblem}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          operation={operation}
          onSelectBottle={selectBottle}
          interactionDisabled={progress !== "playing"}
          onPourAnimationActivityChange={setHasActivePourAnimation}
          onClearingPourComplete={completeClearingPour}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        {showDeadlockNotice ? (
          <DeadlockNotice canUndo={canUndo} undo={undo} restart={restart} />
        ) : (
          <div className="flex h-14 items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-12 rounded-full border bg-background shadow-sm"
              aria-label="待った"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 className="size-5" />
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}

function DeadlockNotice({
  canUndo,
  undo,
  restart,
}: {
  canUndo: boolean;
  undo: () => void;
  restart: () => void;
}) {
  return (
    <div
      role="status"
      className="mx-auto max-w-md rounded-xl border bg-muted/50 px-3 py-2"
    >
      <div className="text-center">
        <p className="text-sm font-semibold">手詰まり</p>
      </div>
      <div className="mt-1 flex justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 />
          待った
        </Button>
        <Button type="button" variant="outline" onClick={restart}>
          <RotateCcw />
          最初から
        </Button>
      </div>
    </div>
  );
}

function PlayHeaderSummary({
  elapsedMs,
  moveCount,
  undoCount,
}: {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
}) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-sm font-semibold tracking-tight">
        ウォーターソート
      </h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] leading-none text-muted-foreground">
        <PlayMetric label="手数" value={String(moveCount)} />
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

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  problemDifficulty: WaterSortDifficultyAssessment;
  result: WaterSortResult;
  recordOutcome: PlayRecordSaveOutcome | null;
  replay: () => void;
  startNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};
function WaterSortResultScreen({
  difficulty,
  problemDifficulty,
  result,
  recordOutcome,
  replay,
  startNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortResultScreenProps) {
  const scorePresentation = getGameResultScorePresentation(result.score);
  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <BrandIdentityHeader />
      <GameResultConfetti intensity={scorePresentation.confettiIntensity} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-5">
        <div className="text-center">
          <GameResultMark presentation={scorePresentation}>
            <span className="block size-12">
              <GamePictogram svg={waterSortPictogramSvg} variant="result" />
            </span>
          </GameResultMark>
          <p className="mt-4 text-sm font-semibold tracking-tight">
            ウォーターソート
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">クリア!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getWaterSortDifficultyLabel(difficulty)}
          </p>
        </div>
        <GameResultScoreCard
          score={result.score}
          presentation={scorePresentation}
        />
        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <ResultMetric label="手数" value={String(result.moveCount)} />
          <ResultMetric label="最短" value={String(result.optimalMoveCount)} />
          <ResultMetric
            label="時間"
            value={formatElapsedTime(result.elapsedMs)}
          />
        </dl>
        <PlayRecordOutcomeNotice outcome={recordOutcome} />
        <div className="mt-7 grid gap-3">
          <Button
            size="lg"
            className="h-12 text-base"
            onClick={startNewProblem}
          >
            次の問題
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-base"
            onClick={replay}
          >
            <RefreshCw />
            もう一度
          </Button>
        </div>
        <div className="mt-4 grid gap-2">
          <Button variant="ghost" onClick={onOpenRecords}>
            記録を見る
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={onChangeDifficulty}>
              難易度を変える
            </Button>
            <Button variant="ghost" onClick={onBackToHome}>
              <Home />
              ホームへ
            </Button>
          </div>
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
            <DetailMetric label="待った" value={`${result.undoCount}回`} />
            <DetailMetric label="やり直し" value={`${result.restartCount}回`} />
            <DetailMetric
              label="問題難易度"
              value={getWaterSortDifficultyLabel(problemDifficulty.difficulty)}
            />
          </dl>
        </details>
        {onOpenDiagnostics && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenDiagnostics}
            >
              <Wrench />
              検証情報
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

type PlayMenuProps = {
  restart: () => void;
  startNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};
function PlayMenu({
  restart,
  startNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
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
          {onOpenDiagnostics && (
            <>
              <div className="my-1 border-t" />
              <MenuButton
                icon={<Wrench />}
                label="検証情報"
                onClick={() => runAndClose(onOpenDiagnostics)}
              />
            </>
          )}
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
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
