import { Home, RefreshCw, Wrench } from "lucide-react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GamePictogram } from "@/components/GamePictogram";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultMark } from "@/components/GameResultMark";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { Button } from "@/components/ui/button";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
  type WaterSortDifficultyAssessment,
} from "@/games/water-sort/difficulty";
import type { WaterSortResult } from "@/games/water-sort/hooks/use-water-sort-play";
import {
  getWaterSortGameResultLevel,
  WATER_SORT_SCORE_MAXIMUMS,
} from "@/games/water-sort/score";
import { formatWaterSortElapsedTime } from "@/games/water-sort/ui/format-elapsed-time";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { DetailMetric } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/DetailMetric";
import { formatScoreTime } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/format-score-time";
import { ResultMetric } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/ScoreCriteria";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  problemDifficulty: WaterSortDifficultyAssessment;
  result: WaterSortResult;
  recordOutcome: PlayRecordSaveOutcome | null;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortResultScreen({
  difficulty,
  problemDifficulty,
  result,
  recordOutcome,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortResultScreenProps) {
  const resultLevel = getWaterSortGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-5">
        <div className="text-center">
          <GameResultMark level={resultLevel}>
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
        <GameResultScoreCard score={result.score.total} level={resultLevel} />
        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <ResultMetric
            label="クリア手数"
            value={String(result.completionMoveCount)}
          />
          <ResultMetric label="最短" value={String(result.optimalMoveCount)} />
          <ResultMetric
            label="時間"
            value={formatWaterSortElapsedTime(result.elapsedMs)}
          />
        </dl>
        <PlayRecordOutcomeNotice
          outcome={recordOutcome}
          display={waterSortPlayRecordDisplay}
        />
        <div className="mt-7 grid gap-3">
          <Button
            size="lg"
            className="h-12 text-base"
            onClick={onStartNewProblem}
          >
            次の問題
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-base"
            onClick={onReplay}
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
            <DetailMetric
              label="手戻り"
              value={`${result.backtrackMoveCount}手`}
            />
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
          <div className="mt-4 border-t pt-4">
            <p className="font-medium text-foreground">採点基準</p>
            <ScoreCriteria result={result} />
          </div>
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

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}
