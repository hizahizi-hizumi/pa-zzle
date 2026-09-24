import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Home,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultIdentity } from "@/components/GameResultIdentity";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import fifteenPuzzlePictogramSvg from "@/games/fifteen-puzzle/assets/pictogram.svg?raw";
import {
  type FifteenPuzzleDifficulty,
  getFifteenPuzzleDifficultyLabel,
} from "@/games/fifteen-puzzle/difficulty";
import type { FifteenPuzzleResult } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import {
  FIFTEEN_PUZZLE_SCORE_MAXIMUMS,
  getFifteenPuzzleGameResultLevel,
} from "@/games/fifteen-puzzle/score";
import { DetailMetric } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleResultScreen/DetailMetric";
import { formatScoreTime } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleResultScreen/format-score-time";
import { ResultMetric } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleResultScreen/ScoreCriteria";
import { formatFifteenPuzzleElapsedTime } from "@/games/fifteen-puzzle/ui/format-elapsed-time";
import {
  formatFifteenPuzzleMoveDelta,
  formatFifteenPuzzleTimeDelta,
} from "@/games/fifteen-puzzle/ui/format-performance-delta";

type FifteenPuzzleResultScreenProps = {
  difficulty: FifteenPuzzleDifficulty;
  result: FifteenPuzzleResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function FifteenPuzzleResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: FifteenPuzzleResultScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultLevel = getFifteenPuzzleGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-y-auto bg-background">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-3 pb-[max(calc(var(--spacing)*4),env(safe-area-inset-bottom))]">
        <GameResultIdentity
          gameName="15パズル"
          difficultyLabel={getFifteenPuzzleDifficultyLabel(difficulty)}
          pictogramSvg={fifteenPuzzlePictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        {recordOutcomeNotice}

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <ResultMetric
            label="手数"
            value={String(result.moveCount)}
            detail={`最短 ${formatFifteenPuzzleMoveDelta(result.moveDelta)}`}
          />
          <ResultMetric
            label="時間"
            value={formatFifteenPuzzleElapsedTime(result.elapsedMs)}
            detail={`基準 ${formatFifteenPuzzleTimeDelta(result.timeDeltaMs)}`}
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

        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <div className="mt-3 flex justify-center">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {detailsOpen ? <ChevronUp /> : <ChevronDown />}
                スコアの内訳・採点基準
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="mt-2 rounded-xl border-(length:--border-width-normal) px-3 py-3 text-supporting text-muted-foreground">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <DetailMetric
                  label="効率"
                  value={`${result.score.breakdown.efficiency} / ${FIFTEEN_PUZZLE_SCORE_MAXIMUMS.efficiency}`}
                />
                <DetailMetric
                  label="速さ"
                  value={`${result.score.breakdown.speed} / ${FIFTEEN_PUZZLE_SCORE_MAXIMUMS.speed}`}
                />
                <DetailMetric
                  label="最短手数"
                  value={`${result.optimalMoveCount}手`}
                />
                <DetailMetric
                  label="基準時間"
                  value={formatScoreTime(result.speedFullScoreMs)}
                />
                <DetailMetric
                  label="完成時の手数"
                  value={`${result.completionMoveCount}手`}
                />
                <DetailMetric
                  label="盤面を戻す"
                  value={`${result.restartCount}回`}
                />
                <DetailMetric
                  label="スライド操作"
                  value={`${result.slideCount}回`}
                />
              </dl>
              <div className="mt-3 border-t-(length:--border-width-normal) pt-3">
                <ScoreCriteria result={result} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
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
