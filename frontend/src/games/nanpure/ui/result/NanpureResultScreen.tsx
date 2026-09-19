import {
  BookOpen,
  Home,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultIdentity } from "@/components/GameResultIdentity";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { Button } from "@/components/ui/button";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import {
  getNanpureDifficultyLabel,
  type NanpureDifficulty,
} from "@/games/nanpure/difficulty";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import {
  getNanpureGameResultLevel,
  NANPURE_SCORE_MAXIMUMS,
} from "@/games/nanpure/score";
import { formatElapsedTime } from "@/games/nanpure/ui/format-elapsed-time";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { DetailMetric } from "@/games/nanpure/ui/result/NanpureResultScreen/DetailMetric";
import { ResultMetric } from "@/games/nanpure/ui/result/NanpureResultScreen/ResultMetric";
import { ScoreCriteria } from "@/games/nanpure/ui/result/NanpureResultScreen/ScoreCriteria";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

type NanpureResultScreenProps = {
  difficulty: NanpureDifficulty;
  result: NanpureResult;
  recordOutcome: PlayRecordSaveOutcome | null;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function NanpureResultScreen({
  difficulty,
  result,
  recordOutcome,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: NanpureResultScreenProps) {
  const resultLevel = getNanpureGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <GameResultIdentity
          gameName="ナンプレ"
          difficultyLabel={getNanpureDifficultyLabel(difficulty)}
          pictogramSvg={nanpurePictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        <PlayRecordOutcomeNotice
          outcome={recordOutcome}
          display={nanpurePlayRecordDisplay}
        />

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <ResultMetric
            label="時間"
            value={formatElapsedTime(result.elapsedMs)}
          />
          <ResultMetric label="ミス" value={String(result.mistakeCount)} />
          <ResultMetric label="待った" value={String(result.undoCount)} />
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
              label="正確さ"
              value={`${result.score.breakdown.accuracy} / ${NANPURE_SCORE_MAXIMUMS.accuracy}`}
            />
            <DetailMetric
              label="速さ"
              value={`${result.score.breakdown.speed} / ${NANPURE_SCORE_MAXIMUMS.speed}`}
            />
            <DetailMetric
              label="安定性"
              value={`${result.score.breakdown.stability} / ${NANPURE_SCORE_MAXIMUMS.stability}`}
            />
            <DetailMetric label="やり直し" value={`${result.restartCount}回`} />
          </dl>
          <div className="mt-3 border-t pt-3">
            <ScoreCriteria />
          </div>
        </details>
      </div>
    </section>
  );
}
