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
import { type ReactNode, useEffect, useRef, useState } from "react";

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
import takuzuPictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import {
  getTakuzuGameResultLevel,
  TAKUZU_SCORE_MAXIMUMS,
} from "@/games/takuzu/score";
import { formatTakuzuElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";
import { formatTakuzuTimeDelta } from "@/games/takuzu/ui/format-performance-delta";
import { DetailMetric } from "@/games/takuzu/ui/TakuzuPlay/TakuzuResultScreen/DetailMetric";
import { ResultMetric } from "@/games/takuzu/ui/TakuzuPlay/TakuzuResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/takuzu/ui/TakuzuPlay/TakuzuResultScreen/ScoreCriteria";

type TakuzuResultScreenProps = {
  difficulty: TakuzuDifficulty;
  result: TakuzuResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuResultScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultLevel = getTakuzuGameResultLevel(result.score.total);
  const screenRef = useRef<HTMLElement>(null);

  // 最後のマスを置くと盤面が操作できなくなり、そのマスにあったフォーカスが失われる。
  // 結果へ移ったらフォーカスを結果画面へ移し、次の Tab で次の行動へ進めるようにする。
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
          gameName="バイナリパズル"
          // 見出し側が「難易度」を添えるので、「難易度 1」のラベルではなく段階の数だけを渡す。
          difficultyLabel={difficulty}
          pictogramSvg={takuzuPictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        {recordOutcomeNotice}

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <ResultMetric
            label="時間"
            value={formatTakuzuElapsedTime(result.elapsedMs)}
            detail={`基準 ${formatTakuzuTimeDelta(result.timeDeltaMs)}`}
          />
          <ResultMetric
            label="置き直し"
            value={`${result.correctionCount}回`}
          />
          <ResultMetric label="盤面を戻す" value={`${result.restartCount}回`} />
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
                  label="正確さ"
                  value={`${result.score.breakdown.accuracy} / ${TAKUZU_SCORE_MAXIMUMS.accuracy}`}
                />
                <DetailMetric
                  label="速さ"
                  value={`${result.score.breakdown.speed} / ${TAKUZU_SCORE_MAXIMUMS.speed}`}
                />
                <DetailMetric
                  label="基準時間"
                  value={formatTakuzuElapsedTime(result.speedFullScoreMs)}
                />
                <DetailMetric
                  label="空きマス"
                  value={`${result.workload.emptyCellCount}マス`}
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
