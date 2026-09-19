import { Check, Clipboard, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  serializeWaterSortDiagnosticSnapshot,
  type WaterSortDiagnosticSnapshot,
} from "@/games/water-sort/diagnostics";
import { getWaterSortDifficultyLabel } from "@/games/water-sort/difficulty";

type WaterSortDiagnosticsProps = {
  snapshot: WaterSortDiagnosticSnapshot;
  open: boolean;
  onClose: () => void;
};

export function WaterSortDiagnostics({
  snapshot,
  open,
  onClose,
}: WaterSortDiagnosticsProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    if (!open) {
      setCopyState("idle");
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const copySnapshot = async () => {
    try {
      await navigator.clipboard.writeText(
        serializeWaterSortDiagnosticSnapshot(snapshot),
      );
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  };

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
        aria-labelledby="water-sort-diagnostics-title"
        className="relative w-full max-w-lg rounded-t-3xl border bg-popover px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl sm:rounded-2xl sm:p-6"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wrench className="size-3.5" />
              内部診断
            </div>
            <h2
              id="water-sort-diagnostics-title"
              className="mt-1 text-lg font-semibold tracking-tight"
            >
              検証情報
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

        <dl className="mt-5 divide-y rounded-xl border bg-muted/25 px-4">
          <DiagnosticRow
            label="難易度"
            value={getWaterSortDifficultyLabel(snapshot.difficulty)}
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
            value={`色 ${snapshot.problemIdentity.conditions.colorCount} / 容量 ${snapshot.problemIdentity.conditions.capacity} / 空 ${snapshot.problemIdentity.conditions.emptyBottleCount}`}
          />
          <DiagnosticRow
            label="生成試行"
            value={String(snapshot.problemIdentity.generationAttempt)}
            mono
          />
          <DiagnosticRow
            label="ビルド"
            value={snapshot.buildRevision ?? "取得なし"}
            mono
            breakAll
          />
        </dl>

        <div className="mt-5 grid">
          <Button size="lg" onClick={copySnapshot}>
            {copyState === "copied" ? <Check /> : <Clipboard />}
            {copyState === "copied"
              ? "コピーしました"
              : copyState === "failed"
                ? "コピーできませんでした"
                : "再現用JSONをコピー"}
          </Button>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
          不具合報告・再現確認のための内部情報です。
        </p>
      </section>
    </div>
  );
}

function DiagnosticRow({
  label,
  value,
  mono = false,
  breakAll = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`${mono ? "font-mono tabular-nums" : "font-medium"} ${breakAll ? "break-all" : ""} text-right text-foreground`}
      >
        {value}
      </dd>
    </div>
  );
}
