import {
  BookOpen,
  Home,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { GameResultConfetti } from "@/components/GameResultConfetti";
import { GameResultIdentity } from "@/components/GameResultIdentity";
import { GameResultScoreCard } from "@/components/GameResultScoreCard";
import { Button } from "@/components/ui/button";
import parkingJamPictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import {
  getParkingJamDifficultyLabel,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  getParkingJamGameResultLevel,
  PARKING_JAM_FAILED_MOVE_PENALTY,
  PARKING_JAM_RESTART_PENALTY,
  PARKING_JAM_SCORE_MAXIMUMS,
  PARKING_JAM_SPEED_FULL_SCORE_MS,
  PARKING_JAM_UNDO_PENALTY,
} from "@/games/parking-jam/score";
import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";

type ParkingJamResultScreenProps = {
  difficulty: ParkingJamDifficulty;
  result: ParkingJamResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function ParkingJamResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: ParkingJamResultScreenProps) {
  const resultLevel = getParkingJamGameResultLevel(result.score.total);

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-y-auto bg-background">
      <BrandIdentityHeader />
      <GameResultConfetti level={resultLevel} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <GameResultIdentity
          gameName="パーキングジャム"
          difficultyLabel={getParkingJamDifficultyLabel(difficulty)}
          pictogramSvg={parkingJamPictogramSvg}
          level={resultLevel}
        />

        <GameResultScoreCard score={result.score.total} level={resultLevel} />

        {recordOutcomeNotice}

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border px-2 py-2 text-center">
            <dt className="text-xs text-muted-foreground">時間</dt>
            <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
              {formatParkingJamElapsedTime(result.elapsedMs)}
            </dd>
          </div>
          <div className="rounded-xl border px-2 py-2 text-center">
            <dt className="text-xs text-muted-foreground">ミス</dt>
            <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
              {result.failedMoveCount}
            </dd>
          </div>
          <div className="rounded-xl border px-2 py-2 text-center">
            <dt className="text-xs text-muted-foreground">待った</dt>
            <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
              {result.undoCount}
            </dd>
          </div>
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
            <div className="flex items-baseline justify-between gap-2">
              <dt>正確さ</dt>
              <dd className="font-mono tabular-nums">
                {result.score.breakdown.accuracy} /{" "}
                {PARKING_JAM_SCORE_MAXIMUMS.accuracy}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt>速さ</dt>
              <dd className="font-mono tabular-nums">
                {result.score.breakdown.speed} /{" "}
                {PARKING_JAM_SCORE_MAXIMUMS.speed}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt>安定性</dt>
              <dd className="font-mono tabular-nums">
                {result.score.breakdown.stability} /{" "}
                {PARKING_JAM_SCORE_MAXIMUMS.stability}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt>やり直し</dt>
              <dd className="font-mono tabular-nums">
                {result.restartCount}回
              </dd>
            </div>
          </dl>
          <div className="mt-3 space-y-1 border-t pt-3 text-xs leading-relaxed">
            <p>
              正確さ: 出せない方向を1回選ぶごとに -
              {PARKING_JAM_FAILED_MOVE_PENALTY}点
            </p>
            <p>
              速さ:{" "}
              {formatParkingJamElapsedTime(
                PARKING_JAM_SPEED_FULL_SCORE_MS[difficulty],
              )}
              まで満点、2倍の時間で0点
            </p>
            <p>
              安定性: 待った1回 -{PARKING_JAM_UNDO_PENALTY}点、やり直し1回 -
              {PARKING_JAM_RESTART_PENALTY}点
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
