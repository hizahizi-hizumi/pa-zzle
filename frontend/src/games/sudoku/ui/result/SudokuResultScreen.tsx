import { useEffect, useRef } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type { SudokuResult } from "@/games/sudoku/hooks/use-sudoku-game";
import { formatElapsedTime } from "@/games/sudoku/ui/format-elapsed-time";

type SudokuResultScreenProps = {
  result: SudokuResult;
  replay: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function SudokuResultScreen({
  result,
  replay,
  newGame,
  onChangeDifficulty,
  onBackToHome,
}: SudokuResultScreenProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animation = contentRef.current?.animate?.(
      [
        { opacity: 0, transform: "translateY(0.5rem)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 280, easing: "ease-out" },
    );

    return () => animation?.cancel();
  }, []);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <BrandIdentityHeader />
      <div
        ref={contentRef}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-6 text-center"
      >
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
