import { Check, Clipboard, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import { InternalDiagnosticRow } from "@/components/InternalDiagnosticsDialog/InternalDiagnosticRow";
import { Button } from "@/components/ui/button";

type InternalDiagnosticsDialogProps = {
  difficultyLabel: string;
  seed: string;
  generatorVersion: string;
  generationConditions: string;
  generationAttempt: number;
  buildRevision: string | null;
  serializedSnapshot: string;
  onClose: () => void;
};

export function InternalDiagnosticsDialog({
  difficultyLabel,
  seed,
  generatorVersion,
  generationConditions,
  generationAttempt,
  buildRevision,
  serializedSnapshot,
  onClose,
}: InternalDiagnosticsDialogProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(serializedSnapshot);
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
        aria-labelledby="internal-diagnostics-title"
        className="relative w-full max-w-lg rounded-t-3xl border bg-popover px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl sm:rounded-2xl sm:p-6"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wrench className="size-3.5" />
              内部診断
            </div>
            <h2
              id="internal-diagnostics-title"
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
          <InternalDiagnosticRow label="難易度" value={difficultyLabel} />
          <InternalDiagnosticRow label="seed" value={seed} mono breakAll />
          <InternalDiagnosticRow
            label="生成器"
            value={`v${generatorVersion}`}
            mono
          />
          <InternalDiagnosticRow
            label="生成条件"
            value={generationConditions}
          />
          <InternalDiagnosticRow
            label="生成試行"
            value={String(generationAttempt)}
            mono
          />
          <InternalDiagnosticRow
            label="ビルド"
            value={buildRevision ?? "取得なし"}
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
