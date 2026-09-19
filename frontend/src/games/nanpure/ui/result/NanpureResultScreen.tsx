import { Home, RefreshCw } from "lucide-react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GamePictogram } from "@/components/GamePictogram";
import {
  GameResultConfetti,
  GameResultMark,
  GameResultScoreCard,
} from "@/components/GameResult";
import { Button } from "@/components/ui/button";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import {
  getNanpureGameResultLevel,
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_SPEED_FULL_SCORE_MS,
  NANPURE_SPEED_PENALTY_PER_INTERVAL,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";
import { formatElapsedTime } from "@/games/nanpure/ui/format-elapsed-time";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

type NanpureResultScreenProps = {
  result: NanpureResult;
  recordOutcome: PlayRecordSaveOutcome | null;
  replay: () => void;
  startNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function NanpureResultScreen({
  result,
  recordOutcome,
  replay,
  startNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: NanpureResultScreenProps) {
  const resultLevel = getNanpureGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-5">
        <div className="text-center">
          <GameResultMark level={resultLevel}>
            <span className="block size-12">
              <GamePictogram svg={nanpurePictogramSvg} variant="result" />
            </span>
          </GameResultMark>
          <p className="mt-4 text-sm font-semibold tracking-tight">ナンプレ</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">クリア!</h1>
        </div>

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <ResultMetric
            label="時間"
            value={formatElapsedTime(result.elapsedMs)}
          />
          <ResultMetric label="ミス" value={String(result.mistakeCount)} />
          <ResultMetric label="待った" value={String(result.undoCount)} />
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
          <div className="mt-4 border-t pt-4">
            <p className="font-medium text-foreground">採点基準</p>
            <ScoreCriteria />
          </div>
        </details>
      </div>
    </section>
  );
}

function ScoreCriteria() {
  return (
    <dl className="mt-3 grid gap-3 text-xs">
      <div>
        <dt className="font-semibold text-foreground">正確さ</dt>
        <dd className="mt-0.5">
          ミスなしで{NANPURE_SCORE_MAXIMUMS.accuracy}点。ミス1回につき
          {NANPURE_MISTAKE_PENALTY}点減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-0.5">
          {formatElapsedTime(NANPURE_SPEED_FULL_SCORE_MS)}以内で
          {NANPURE_SCORE_MAXIMUMS.speed}点。超過時間を1分単位で切り上げ、
          1分につき{NANPURE_SPEED_PENALTY_PER_INTERVAL}点減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">安定性</dt>
        <dd className="mt-0.5">
          待った・やり直しなしで{NANPURE_SCORE_MAXIMUMS.stability}
          点。待った1回につき
          {NANPURE_UNDO_PENALTY}点、やり直し1回につき
          {NANPURE_RESTART_PENALTY}点減点。
        </dd>
      </div>
      <div>
        <dt className="sr-only">下限</dt>
        <dd>各項目は0点を下限とします。</dd>
      </div>
    </dl>
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
