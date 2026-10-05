import { Wrench } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultIdentity } from "@/components/GameResultIdentity";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { GameResultActions } from "@/components/GameResultScreen/GameResultActions";
import {
  GameResultDetails,
  type GameResultScoreCriteria,
} from "@/components/GameResultScreen/GameResultDetails";
import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import {
  type GameResultMetric,
  ResultMetric,
} from "@/components/GameResultScreen/ResultMetric";
import { Button } from "@/components/ui/button";
import { getGameResultLevel } from "@/games/result";

export type { GameResultScoreCriteria };

type GameResultMetrics =
  | readonly [GameResultMetric, GameResultMetric]
  | readonly [GameResultMetric, GameResultMetric, GameResultMetric];

const metricColumnsClassNames = {
  2: "grid-cols-2",
  3: "grid-cols-3",
} as const;

type GameResultScreenProps = {
  gameName: string;
  difficultyLabel: string;
  pictogramSvg: string;
  score: number;
  /** 開いたときに見せるスコアの内訳と、評価材料になった問題の値。 */
  scoreBreakdown: readonly GameResultDetailMetric[];
  scoreCriteria: GameResultScoreCriteria;
  /** 評価を理解するためのゲーム固有の主要成績。1行に並べる。 */
  metrics: GameResultMetrics;
  recordOutcomeNotice: ReactNode;
  onStartNewProblem: () => void;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  /** 省略すると検証情報を開く操作を出さない。 */
  onOpenDiagnostics?: () => void;
};

export function GameResultScreen({
  gameName,
  difficultyLabel,
  pictogramSvg,
  score,
  metrics,
  recordOutcomeNotice,
  scoreBreakdown,
  scoreCriteria,
  onStartNewProblem,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: GameResultScreenProps) {
  const resultLevel = getGameResultLevel(score);
  const screenRef = useRef<HTMLElement>(null);

  // クリアした操作の対象は盤面ごと消え、フォーカスも失われる。
  // 結果画面へフォーカスを移し、次の Tab で次の行動へ進めるようにする。
  useEffect(() => {
    screenRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      ref={screenRef}
      tabIndex={-1}
      aria-label="プレイ結果"
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-y-auto bg-background outline-none"
    >
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-3 pb-[max(calc(var(--spacing)*4),env(safe-area-inset-bottom))]">
        <GameResultIdentity
          gameName={gameName}
          difficultyLabel={difficultyLabel}
          pictogramSvg={pictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={score} level={resultLevel} />

        {recordOutcomeNotice}

        <dl
          className={`mt-3 grid ${metricColumnsClassNames[metrics.length]} gap-2`}
        >
          {metrics.map((metric) => (
            <ResultMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </dl>

        <GameResultActions
          onStartNewProblem={onStartNewProblem}
          onReplay={onReplay}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
        />

        <GameResultDetails
          breakdown={scoreBreakdown}
          criteria={scoreCriteria}
        />

        {onOpenDiagnostics && (
          <div className="mt-1 flex justify-center">
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
