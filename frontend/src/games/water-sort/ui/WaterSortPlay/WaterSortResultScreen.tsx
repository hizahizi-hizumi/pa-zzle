import {
  BookOpen,
  Home,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultIdentity } from "@/components/GameResultIdentity";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { Button } from "@/components/ui/button";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import {
  getWaterSortGameResultLevel,
  WATER_SORT_SCORE_MAXIMUMS,
} from "@/games/water-sort/score";
import { formatWaterSortElapsedTime } from "@/games/water-sort/ui/format-elapsed-time";
import { DetailMetric } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/DetailMetric";
import { formatScoreTime } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/format-score-time";
import { ResultMetric } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/ScoreCriteria";

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  result: WaterSortResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortResultScreenProps) {
  const resultLevel = getWaterSortGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <GameResultIdentity
          gameName="ウォーターソート"
          difficultyLabel={getWaterSortDifficultyLabel(difficulty)}
          pictogramSvg={waterSortPictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        {recordOutcomeNotice}

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <ResultMetric
            label="手数"
            value={String(result.completionMoveCount)}
            detail={`最短 ${formatMoveDelta(result.moveDelta)}`}
          />
          <ResultMetric
            label="時間"
            value={formatWaterSortElapsedTime(result.elapsedMs)}
          />
          <ResultMetric
            label="手戻り"
            value={String(result.backtrackMoveCount)}
          />
        </dl>

        <div className="mt-4 grid gap-3">
          <Button size="lg" onClick={onStartNewProblem}>
            <Play />
            プレイ！
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onReplay}>
              <RotateCcw />
              同じ問題
            </Button>
            <Button variant="outline" onClick={onOpenRecords}>
              <BookOpen />
              記録を確認
            </Button>
            <Button variant="outline" onClick={onChangeDifficulty}>
              <SlidersHorizontal />
              難易度変更
            </Button>
            <Button variant="outline" onClick={onBackToHome}>
              <Home />
              ホーム
            </Button>
          </div>
        </div>

        <details className="mt-3 rounded-xl border px-3 py-2 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none text-center text-xs font-medium text-foreground">
            スコアの内訳・採点基準
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <DetailMetric
              label="効率"
              value={`${result.score.breakdown.efficiency} / ${WATER_SORT_SCORE_MAXIMUMS.efficiency}`}
            />
            <DetailMetric
              label="速さ"
              value={`${result.score.breakdown.speed} / ${WATER_SORT_SCORE_MAXIMUMS.speed}`}
            />
            <DetailMetric
              label="正確性"
              value={`${result.score.breakdown.accuracy} / ${WATER_SORT_SCORE_MAXIMUMS.accuracy}`}
            />
            <DetailMetric
              label="基準時間"
              value={formatScoreTime(result.speedFullScoreMs)}
            />
            <DetailMetric label="総手数" value={String(result.moveCount)} />
            <DetailMetric label="待った" value={`${result.undoCount}回`} />
            <DetailMetric label="やり直し" value={`${result.restartCount}回`} />
          </dl>
          <div className="mt-3 border-t pt-3">
            <ScoreCriteria result={result} />
          </div>
        </details>
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

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}
