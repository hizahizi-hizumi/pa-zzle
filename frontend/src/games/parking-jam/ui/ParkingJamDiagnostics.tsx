import { Check, Clipboard, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type ParkingJamDiagnosticSnapshot,
  serializeParkingJamDiagnosticSnapshot,
} from "@/games/parking-jam/diagnostics";
import {
  getParkingJamDifficultyLabel,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
} from "@/games/parking-jam/difficulty";
import { DiagnosticRow } from "@/games/parking-jam/ui/ParkingJamDiagnostics/DiagnosticRow";

type ParkingJamDiagnosticsProps = {
  snapshot: ParkingJamDiagnosticSnapshot;
  onClose: () => void;
};

function formatRatio(value: number | null): string {
  return value === null ? "取得なし" : `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value: number | null): string {
  return value === null ? "取得なし" : value.toFixed(3);
}

function formatInteger(value: number | null): string {
  return value === null ? "取得なし" : String(value);
}

export function ParkingJamDiagnostics({
  snapshot,
  onClose,
}: ParkingJamDiagnosticsProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const { features } = snapshot.difficultyAnalysis;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(
        serializeParkingJamDiagnosticSnapshot(snapshot),
      );
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
        aria-label="検証情報を閉じる"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="parking-jam-diagnostics-title"
        className="relative flex max-h-[92svh] w-full max-w-xl flex-col rounded-t-3xl border bg-popover text-popover-foreground shadow-xl sm:max-h-[85svh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wrench className="size-3.5" />
              内部診断
            </div>
            <h2
              id="parking-jam-diagnostics-title"
              className="mt-1 text-lg font-semibold tracking-tight"
            >
              難易度特徴
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="閉じる"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          <h3 className="text-xs font-semibold text-muted-foreground">問題</h3>
          <dl className="mt-2 divide-y rounded-xl border bg-muted/25 px-4">
            <DiagnosticRow
              label="難易度"
              value={getParkingJamDifficultyLabel(snapshot.difficulty)}
            />
            <DiagnosticRow
              label="判定モデル"
              value={PARKING_JAM_DIFFICULTY_MODEL_VERSION}
              mono
            />
            <DiagnosticRow
              label="seed"
              value={snapshot.problemIdentity.seed}
              mono
              breakAll
            />
            <DiagnosticRow
              label="生成器"
              value={`v${snapshot.problemIdentity.generatorVersion}`}
              mono
            />
            <DiagnosticRow
              label="生成条件"
              value={`${snapshot.problemIdentity.conditions.width}×${snapshot.problemIdentity.conditions.height} / 車 ${snapshot.problemIdentity.conditions.vehicleCount} / 開口 ${snapshot.problemIdentity.conditions.roadOpeningCount}×${snapshot.problemIdentity.conditions.roadOpeningSpan} / 固定物 ${snapshot.problemIdentity.conditions.fixedAreaCount}×${snapshot.problemIdentity.conditions.fixedAreaLength} / 遮断 ${snapshot.problemIdentity.conditions.blockingPlacementProbability}`}
            />
            <DiagnosticRow
              label="生成試行"
              value={String(snapshot.problemIdentity.generationAttempt)}
              mono
            />
          </dl>

          <h3 className="mt-5 text-xs font-semibold text-muted-foreground">
            構造
          </h3>
          <dl className="mt-2 divide-y rounded-xl border bg-muted/25 px-4">
            <DiagnosticRow
              label="依存深さ"
              value={String(features.dependencyDepth)}
              mono
            />
            <DiagnosticRow
              label="初期合法車"
              value={`${features.initialLegalVehicleCount} / ${formatRatio(features.initialLegalVehicleRatio)}`}
              mono
            />
            <DiagnosticRow
              label="平均合法車率"
              value={formatRatio(features.averageLegalVehicleRatio)}
              mono
            />
            <DiagnosticRow
              label="最小合法車率"
              value={formatRatio(features.minimumLegalVehicleRatio)}
              mono
            />
            <DiagnosticRow
              label="強制選択状態率"
              value={formatRatio(features.forcedChoiceStateRatio)}
              mono
            />
            <DiagnosticRow
              label="新規解放"
              value={`平均 ${formatDecimal(features.averageNewlyUnlockedVehicleCount)} / 最大 ${formatInteger(features.maximumNewlyUnlockedVehicleCount)}`}
              mono
            />
            <DiagnosticRow
              label="必須先行関係"
              value={formatInteger(features.requiredPrecedenceCount)}
              mono
            />
            <DiagnosticRow
              label="最大必須先行"
              value={formatInteger(features.maximumRequiredPredecessorCount)}
              mono
            />
            <DiagnosticRow
              label="車両遮断辺"
              value={String(features.vehicleBlockingEdgeCount)}
              mono
            />
            <DiagnosticRow
              label="最大遮断次数"
              value={`先 ${features.maximumVehicleBlockingOutDegree} / 被 ${features.maximumVehicleBlockingInDegree}`}
              mono
            />
            <DiagnosticRow
              label="解順"
              value={features.legalOrderCount ?? "取得なし"}
              mono
              breakAll
            />
            <DiagnosticRow
              label="解順自由度"
              value={formatDecimal(features.solutionOrderFreedom)}
              mono
            />
            <DiagnosticRow
              label="到達状態数"
              value={formatInteger(features.reachableStateCount)}
              mono
            />
          </dl>

          <h3 className="mt-5 text-xs font-semibold text-muted-foreground">
            方向・視覚探索
          </h3>
          <dl className="mt-2 divide-y rounded-xl border bg-muted/25 px-4">
            <DiagnosticRow
              label="車両数"
              value={String(features.vehicleCount)}
              mono
            />
            <DiagnosticRow
              label="退出方向"
              value={String(features.availableExitDirectionCount)}
              mono
            />
            <DiagnosticRow
              label="初期遮断方向"
              value={`${features.initialBlockedExitDirectionCount} / ${formatRatio(features.initialBlockedExitDirectionRatio)}`}
              mono
            />
            <DiagnosticRow
              label="平均合法方向"
              value={formatDecimal(features.averageLegalDirectionCount)}
              mono
            />
            <DiagnosticRow
              label="車セル占有率"
              value={formatRatio(features.vehicleCellOccupancyRatio)}
              mono
            />
            <DiagnosticRow
              label="長車率"
              value={formatRatio(features.longVehicleRatio)}
              mono
            />
            <DiagnosticRow
              label="道路開口率"
              value={formatRatio(features.roadOpeningCoverageRatio)}
              mono
            />
            <DiagnosticRow
              label="退出距離"
              value={`平均 ${features.averageExitPathLength.toFixed(2)} / 最大 ${features.maximumExitPathLength}`}
              mono
            />
            <DiagnosticRow
              label="ビルド"
              value={snapshot.buildRevision ?? "取得なし"}
              mono
              breakAll
            />
          </dl>
        </div>

        <div className="shrink-0 border-t px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <div className="grid">
            <Button size="lg" onClick={copySnapshot}>
              {copyState === "copied" ? <Check /> : <Clipboard />}
              {copyState === "copied"
                ? "コピーしました"
                : copyState === "failed"
                  ? "コピーできませんでした"
                  : "検証JSONをコピー"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
