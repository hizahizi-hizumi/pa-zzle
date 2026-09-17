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
import type {
  WaterSortOperation,
  WaterSortProgress,
  WaterSortResult,
} from "@/games/water-sort/hooks/use-water-sort-game";
import { WaterSortBoard } from "@/games/water-sort/ui/WaterSortBoard";

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
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  result: WaterSortResult | null;
  selectBottle: (bottleIndex: number) => void;
  undo: () => void;
  restart: () => void;
  newGame: () => void;
  completeClearingPour: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
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
  sourceBottleIndex,
  operation,
  result,
  selectBottle,
  undo,
  restart,
  newGame,
  completeClearingPour,
  onChangeDifficulty,
  onBackToHome,
}: WaterSortPlayProps) {
  if (progress === "result" && status === "cleared" && result) {
    return (
      <WaterSortResultScreen difficulty={difficulty} problemDifficulty={problemDifficulty} result={result} restart={restart} newGame={newGame} onChangeDifficulty={onChangeDifficulty} onBackToHome={onBackToHome} />
    );
  }

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center px-3">
        <Button type="button" variant="ghost" size="icon-lg" aria-label="難易度選択へ戻る" onClick={onChangeDifficulty}><ArrowLeft /></Button>
        <PlayHeaderSummary elapsedMs={elapsedMs} moveCount={moveCount} undoCount={undoCount} />
        <PlayMenu restart={restart} newGame={newGame} onChangeDifficulty={onChangeDifficulty} onBackToHome={onBackToHome} />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <WaterSortBoard state={state} sourceBottleIndex={sourceBottleIndex} operation={operation} onSelectBottle={selectBottle} interactionDisabled={progress !== "playing"} onClearingPourComplete={completeClearingPour} />
      </main>
      <footer className="flex h-16 shrink-0 items-center justify-center px-4">
        <Button type="button" variant="ghost" size="icon-lg" className="size-12 rounded-full border bg-background shadow-sm" aria-label="元に戻す" onClick={undo} disabled={!canUndo}><Undo2 className="size-5" /></Button>
      </footer>
    </section>
  );
}

function PlayHeaderSummary({ elapsedMs, moveCount, undoCount }: { elapsedMs: number; moveCount: number; undoCount: number }) {
  return <div className="min-w-0 text-center"><BrandMark /><h1 className="mt-0.5 truncate text-sm font-semibold tracking-tight">カラーウォーターソート</h1><div className="mt-1 flex items-center justify-center gap-2 text-[10px] leading-none text-muted-foreground"><PlayMetric label="手数" value={String(moveCount)} /><MetricSeparator /><PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} /><MetricSeparator /><PlayMetric label="待った" value={String(undoCount)} /></div></div>;
}
function PlayMetric({ label, value }: { label: string; value: string }) { return <span className="flex items-baseline gap-1 whitespace-nowrap"><span>{label}</span><span className="font-mono font-medium tabular-nums text-foreground/80">{value}</span></span>; }
function MetricSeparator() { return <span aria-hidden="true" className="text-border">·</span>; }

type WaterSortResultScreenProps = { difficulty: WaterSortDifficulty; problemDifficulty: WaterSortDifficultyAssessment; result: WaterSortResult; restart: () => void; newGame: () => void; onChangeDifficulty: () => void; onBackToHome: () => void };
function WaterSortResultScreen({ difficulty, problemDifficulty, result, restart, newGame, onChangeDifficulty, onBackToHome }: WaterSortResultScreenProps) {
  const scorePresentation = getScorePresentation(result.score);
  return <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background px-5 pt-[max(2.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <div className="pointer-events-none absolute inset-x-0 top-[max(0.8rem,env(safe-area-inset-top))] z-10 flex justify-center"><BrandMark /></div>
    <ConfettiBurst intensity={scorePresentation.confettiIntensity} />
    <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-5">
      <div className="text-center"><ClearMark className={scorePresentation.markClassName} /><p className="mt-4 text-sm font-semibold tracking-tight">カラーウォーターソート</p><h1 className="mt-1 text-3xl font-bold tracking-tight">クリア!</h1><p className="mt-1 text-sm text-muted-foreground">{getWaterSortDifficultyLabel(difficulty)}</p></div>
      <ScoreCard score={result.score} presentation={scorePresentation} />
      <dl className="mt-6 grid grid-cols-3 gap-2 text-center"><ResultMetric label="手数" value={String(result.moveCount)} /><ResultMetric label="最短" value={String(result.optimalMoveCount)} /><ResultMetric label="時間" value={formatElapsedTime(result.elapsedMs)} /></dl>
      <div className="mt-7 grid gap-3"><Button size="lg" className="h-12 text-base" onClick={newGame}>次の問題</Button><Button variant="outline" size="lg" className="h-12 text-base" onClick={restart}><RefreshCw />もう一度</Button></div>
      <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="ghost" onClick={onChangeDifficulty}>難易度を変える</Button><Button variant="ghost" onClick={onBackToHome}><Home />ホームへ</Button></div>
      <details className="mt-6 rounded-lg border px-4 py-3 text-sm text-muted-foreground"><summary className="cursor-pointer select-none font-medium text-foreground">プレイ詳細</summary><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><DetailMetric label="最短との差" value={formatMoveDelta(result.moveDelta)} /><DetailMetric label="元に戻す" value={`${result.undoCount}回`} /><DetailMetric label="やり直し" value={`${result.restartCount}回`} /><DetailMetric label="問題難易度" value={getWaterSortDifficultyLabel(problemDifficulty.difficulty)} /></dl></details>
    </div>
  </section>;
}

type ScorePresentation = { message: string; scoreClassName: string; panelClassName: string; markClassName: string; confettiIntensity: "strong" | "light" | null };
function getScorePresentation(score: number): ScorePresentation {
  if (score >= 100) return { message: "パーフェクト！", scoreClassName: "text-amber-600 dark:text-amber-300", panelClassName: "border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/30", markClassName: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", confettiIntensity: "strong" };
  if (score >= 90) return { message: "すばらしい！", scoreClassName: "text-emerald-600 dark:text-emerald-300", panelClassName: "border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/70 dark:bg-emerald-950/30", markClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", confettiIntensity: "light" };
  if (score >= 80) return { message: "ナイスプレイ！", scoreClassName: "text-sky-600 dark:text-sky-300", panelClassName: "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30", markClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300", confettiIntensity: null };
  return { message: "クリア！", scoreClassName: "text-foreground", panelClassName: "border-border bg-muted/40", markClassName: "bg-muted text-foreground", confettiIntensity: null };
}
function ScoreCard({ score, presentation }: { score: number; presentation: ScorePresentation }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; if (reduced) return; cardRef.current?.animate?.([{ transform: "scale(0.94)", opacity: 0 }, { transform: "scale(1.025)", opacity: 1, offset: 0.72 }, { transform: "scale(1)", opacity: 1 }], { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)", delay: 120 }); }, []);
  return <div ref={cardRef} className={`mt-6 rounded-3xl border px-5 py-5 text-center shadow-sm ${presentation.panelClassName}`}><p className={`text-sm font-bold tracking-wide ${presentation.scoreClassName}`}>{presentation.message}</p><p className="mt-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">スコア</p><p className={`mt-1 font-mono text-6xl font-bold tracking-tight tabular-nums ${presentation.scoreClassName}`}>{score}<span className="ml-1 text-base font-medium text-muted-foreground"> / 100</span></p></div>;
}
function BrandMark() { return <span className="select-none text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80">パズル pa-zzle</span>; }
function ClearMark({ className }: { className: string }) {
  const markRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; if (reduced) return; markRef.current?.animate?.([{ transform: "scale(0.65) rotate(-8deg)", opacity: 0 }, { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.7 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" }); }, []);
  return <div ref={markRef} className={`mx-auto flex size-20 items-center justify-center rounded-full shadow-sm ${className}`} aria-hidden="true"><Trophy className="size-9" /></div>;
}
const confettiPieces = [[-130,-170,-210,"#f59e0b"],[-100,-125,170,"#10b981"],[-72,-190,-120,"#38bdf8"],[-44,-145,260,"#f472b6"],[-18,-205,-180,"#a78bfa"],[16,-178,220,"#facc15"],[44,-212,-250,"#34d399"],[72,-150,180,"#60a5fa"],[104,-188,-160,"#fb7185"],[136,-132,240,"#f59e0b"],[-150,-82,180,"#22c55e"],[-112,-58,-230,"#38bdf8"],[-76,-96,140,"#f472b6"],[-38,-68,250,"#facc15"],[0,-102,-190,"#a78bfa"],[40,-72,210,"#34d399"],[78,-108,-150,"#fb7185"],[116,-64,260,"#60a5fa"],[150,-94,-220,"#f59e0b"],[-126,-218,160,"#f472b6"],[-56,-238,-250,"#38bdf8"],[28,-242,210,"#facc15"],[92,-224,-170,"#22c55e"],[154,-196,240,"#a78bfa"]] as const;
function ConfettiBurst({ intensity }: { intensity: ScorePresentation["confettiIntensity"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!intensity) return; const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; if (reduced) return; const pieces = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-confetti-piece]") ?? []); for (const [index,piece] of pieces.entries()) { const [x,y,rotation] = confettiPieces[index] ?? [0,-100,180]; piece.animate?.([{ transform: "translate(0, 0) scale(0.35)", opacity: 0 },{ transform: "translate(0, -12px) scale(1)", opacity: 1, offset: 0.1 },{ transform: `translate(${x * 0.78}px, ${y * 0.78}px) rotate(${rotation * 0.78}deg) scale(1)`, opacity: 1, offset: 0.72 },{ transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(0.85)`, opacity: 0 }],{ duration: 1350 + (index % 4) * 100, delay: 90 + (index % 6) * 34, easing: "cubic-bezier(.2,.7,.2,1)" }); } }, [intensity]);
  if (!intensity) return null;
  const pieceCount = intensity === "strong" ? 24 : 12;
  return <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden="true">{confettiPieces.slice(0,pieceCount).map(([x,y,rotation,color]) => <span key={`${x}-${y}-${rotation}`} data-confetti-piece className="absolute left-1/2 top-[38%] h-3 w-1.5 rounded-sm opacity-0" style={{ backgroundColor: color }} />)}</div>;
}
type PlayMenuProps = { restart: () => void; newGame: () => void; onChangeDifficulty: () => void; onBackToHome: () => void };
function PlayMenu({ restart, newGame, onChangeDifficulty, onBackToHome }: PlayMenuProps) {
  const [isOpen,setIsOpen] = useState(false);
  const runAndClose = (action: () => void) => { setIsOpen(false); action(); };
  return <div className="relative"><Button type="button" variant="ghost" size="icon-lg" aria-label="その他の操作" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}><MoreHorizontal /></Button>{isOpen && <div role="menu" className="absolute top-11 right-0 z-10 grid w-44 gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"><MenuButton icon={<RotateCcw />} label="最初から" onClick={() => runAndClose(restart)} /><MenuButton icon={<RefreshCw />} label="新しい問題" onClick={() => runAndClose(newGame)} /><MenuButton label="難易度を変える" onClick={() => runAndClose(onChangeDifficulty)} /><MenuButton icon={<Home />} label="ホームへ" onClick={() => runAndClose(onBackToHome)} /></div>}</div>;
}
function MenuButton({ icon, label, onClick }: { icon?: ReactNode; label: string; onClick: () => void }) { return <button type="button" role="menuitem" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick}>{icon}<span>{label}</span></button>; }
function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/70 px-2 py-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</dd></div>; }
function DetailMetric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs">{label}</dt><dd className="mt-0.5 font-medium text-foreground">{value}</dd></div>; }
function formatMoveDelta(moveDelta: number): string { return moveDelta === 0 ? "±0" : `+${moveDelta}`; }
function formatElapsedTime(elapsedMs: number): string { const totalSeconds = Math.floor(elapsedMs / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; if (hours > 0) return `${hours}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`; return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`; }
