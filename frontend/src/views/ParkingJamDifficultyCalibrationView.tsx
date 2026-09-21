import { useMemo, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type ParkingJamDifficultyCalibrationComparison,
  parkingJamDifficultyCalibrationComparisons,
} from "@/games/parking-jam/difficulty-calibration";
import { ParkingJamCalibrationTrial } from "@/games/parking-jam/difficulty-calibration/ParkingJamCalibrationTrial";
import {
  clearParkingJamCalibrationResults,
  loadParkingJamCalibrationResults,
  type ParkingJamCalibrationComparisonResult,
  type ParkingJamCalibrationJudgement,
  type ParkingJamCalibrationTrialResult,
  saveParkingJamCalibrationResults,
} from "@/games/parking-jam/difficulty-calibration/results";

export function ParkingJamDifficultyCalibrationView() {
  const [results, setResults] = useState<
    ParkingJamCalibrationComparisonResult[]
  >(() => loadParkingJamCalibrationResults());
  const [comparisonIndex, setComparisonIndex] = useState(() =>
    Math.min(
      loadParkingJamCalibrationResults().length,
      parkingJamDifficultyCalibrationComparisons.length,
    ),
  );
  const [stage, setStage] = useState<"left" | "right" | "judge">("left");
  const [leftResult, setLeftResult] =
    useState<ParkingJamCalibrationTrialResult | null>(null);
  const [rightResult, setRightResult] =
    useState<ParkingJamCalibrationTrialResult | null>(null);
  const [copied, setCopied] = useState(false);
  const comparison =
    parkingJamDifficultyCalibrationComparisons[comparisonIndex];
  const report = useMemo(
    () =>
      JSON.stringify(
        {
          calibrationVersion: "parking-jam-r3-v1",
          results,
        },
        null,
        2,
      ),
    [results],
  );

  function completeTrial(result: ParkingJamCalibrationTrialResult): void {
    if (stage === "left") {
      setLeftResult(result);
      setStage("right");
      return;
    }
    setRightResult(result);
    setStage("judge");
  }

  function recordJudgement(judgement: ParkingJamCalibrationJudgement): void {
    if (!comparison || !leftResult || !rightResult) return;
    const nextResult: ParkingJamCalibrationComparisonResult = {
      comparisonId: comparison.id,
      left: leftResult,
      right: rightResult,
      judgement,
    };
    const nextResults = [...results, nextResult];
    saveParkingJamCalibrationResults(nextResults);
    setResults(nextResults);
    setComparisonIndex((current) => current + 1);
    setStage("left");
    setLeftResult(null);
    setRightResult(null);
    setCopied(false);
  }

  function resetCalibration(): void {
    clearParkingJamCalibrationResults();
    setResults([]);
    setComparisonIndex(0);
    setStage("left");
    setLeftResult(null);
    setRightResult(null);
    setCopied(false);
  }

  async function copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function problemIdForStage(
    currentComparison: ParkingJamDifficultyCalibrationComparison,
  ) {
    return stage === "left"
      ? currentComparison.leftProblemId
      : currentComparison.rightProblemId;
  }

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">パーキングジャム 難易度比較</h1>
          <p className="text-sm text-muted-foreground">
            生成条件や機械判定を見ず、盤面を実際に遊んで比較します。
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={resetCalibration}
        >
          最初から
        </Button>
      </header>

      {comparison ? (
        <main className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
          <p className="mb-2 text-sm text-muted-foreground">
            比較 {comparisonIndex + 1} /{" "}
            {parkingJamDifficultyCalibrationComparisons.length}
          </p>
          {stage === "judge" ? (
            <section className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
              <div>
                <h2 className="text-xl font-semibold">
                  どちらが難しく感じましたか？
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  時間の長さだけでなく、考える必要があった強さで比較してください。
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recordJudgement("left-harder")}
                >
                  問題A
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recordJudgement("similar")}
                >
                  同じくらい
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recordJudgement("right-harder")}
                >
                  問題B
                </Button>
              </div>
            </section>
          ) : (
            <ParkingJamCalibrationTrial
              key={`${comparison.id}-${stage}`}
              label={stage === "left" ? "問題 A" : "問題 B"}
              problemId={problemIdForStage(comparison)}
              onComplete={completeTrial}
            />
          )}
        </main>
      ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-auto px-4 py-6">
          <div>
            <h2 className="text-xl font-semibold">比較完了</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              下の結果をこのIssueのR3校正結果として利用できます。
            </p>
          </div>
          <Textarea readOnly value={report} rows={18} />
          <div className="flex justify-end">
            <Button type="button" onClick={() => void copyReport()}>
              {copied ? "コピー済み" : "結果をコピー"}
            </Button>
          </div>
        </main>
      )}
    </section>
  );
}
