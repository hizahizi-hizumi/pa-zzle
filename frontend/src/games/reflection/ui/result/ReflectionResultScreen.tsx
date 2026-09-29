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
import reflectionPictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  getReflectionLaserPathPolicy,
  type ReflectionLaserPathMode,
} from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import { getReflectionGameResultLevel } from "@/games/reflection/score";
import type { ReflectionSessionResult } from "@/games/reflection/session/session";
import { DetailMetric } from "@/games/reflection/ui/result/ReflectionResultScreen/DetailMetric";
import { ResultMetric } from "@/games/reflection/ui/result/ReflectionResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/reflection/ui/result/ReflectionResultScreen/ScoreCriteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type ReflectionResultScreenProps = {
  /** 結果に出す難易度の表示名。問題を指定したプレイでは難易度を伏せた名前を渡す。 */
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  /** そのプレイで起きた事実。 */
  performance: ReflectionSessionResult;
  /** 事実と問題の作業の量から導いた評価。問題集に無い問題を指定したプレイでは作業の量が無く、`null`。 */
  result: ReflectionResult | null;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function ReflectionResultScreen({
  difficultyLabel,
  laserPathMode,
  performance,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ReflectionResultScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultLevel = result
    ? getReflectionGameResultLevel(result.score)
    : "clear";
  const { showsCheckCountInResult } =
    getReflectionLaserPathPolicy(laserPathMode);
  const screenRef = useRef<HTMLElement>(null);

  // 最後のピースを置くと盤面が操作できなくなり、そのマスにあったフォーカスが失われる。
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
          gameName={REFLECTION_DISPLAY_NAME}
          difficultyLabel={difficultyLabel}
          pictogramSvg={reflectionPictogramSvg}
          level={resultLevel}
        />

        {result ? (
          <GameResultScoreCard score={result.score} level={resultLevel} />
        ) : (
          <p className="mt-3 bg-muted/55 px-3 py-3 text-center text-supporting text-muted-foreground">
            問題集に無い問題のため、スコアは出しません。
          </p>
        )}

        {recordOutcomeNotice}

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <ResultMetric
            label="時間"
            value={formatElapsedTime(performance.elapsedMs)}
            detail={
              result
                ? `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`
                : undefined
            }
          />
          <ResultMetric
            label="置き直し"
            value={String(performance.relocationCount)}
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

        {result && (
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
              <div className="mt-2 bg-muted/55 px-3 py-3 text-supporting text-muted-foreground">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <DetailMetric
                    label="盤面戻し"
                    value={`${result.restartCount}回`}
                  />
                  {showsCheckCountInResult && (
                    <DetailMetric
                      label="光路の確認"
                      value={`${result.laserCheckCount}回`}
                    />
                  )}
                  <DetailMetric
                    label="基準時間"
                    value={formatElapsedTime(result.speedFullScoreMs)}
                  />
                  <DetailMetric
                    label="ピース"
                    value={`${result.workload.pieceCount}個`}
                  />
                  <DetailMetric
                    label="外周ヒント"
                    value={`${result.workload.clueCount}本`}
                  />
                  <DetailMetric
                    label="照らし直す局面"
                    value={`${result.workload.propagationRoundCount}回`}
                  />
                  <DetailMetric
                    label="仮に置いて確かめる"
                    value={`${result.workload.assumptionTestCount}回`}
                  />
                  <DetailMetric
                    label="試し置き"
                    value={
                      result.workload.trialMoveCount === null
                        ? "試し置きでは解けない"
                        : `${result.workload.trialMoveCount}手`
                    }
                  />
                </dl>
                <div className="mt-4">
                  <ScoreCriteria result={result} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
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
