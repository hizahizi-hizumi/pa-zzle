import { Check, Clipboard, Wrench, X } from "lucide-react";
import { useState } from "react";

import { InternalDiagnosticRow } from "@/components/InternalDiagnosticsDialog/InternalDiagnosticRow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InternalDiagnosticsDialogProps = {
  difficultyLabel: string;
  seed: string;
  generatorVersion: string;
  generationConditions: string;
  /** 生成を試し直す回数を持たないゲーム（事前生成した問題集から選ぶなど）では省略する。 */
  generationAttempt?: number;
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

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

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
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-meta font-medium text-muted-foreground">
                <Wrench className="size-3.5" />
                内部診断
              </div>
              <DialogTitle>検証情報</DialogTitle>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="閉じる"
              >
                <X />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription>
            不具合報告・再現確認のための内部情報です。
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y-(length:--border-width-normal) rounded-xl border-(length:--border-width-normal) bg-muted/25 px-4">
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
          {generationAttempt !== undefined && (
            <InternalDiagnosticRow
              label="生成試行"
              value={String(generationAttempt)}
              mono
            />
          )}
          <InternalDiagnosticRow
            label="ビルド"
            value={buildRevision ?? "取得なし"}
            mono
            breakAll
          />
        </dl>

        <div className="grid">
          <Button size="lg" onClick={copySnapshot}>
            {copyState === "copied" ? <Check /> : <Clipboard />}
            {copyState === "copied"
              ? "コピーしました"
              : copyState === "failed"
                ? "コピーできませんでした"
                : "再現用JSONをコピー"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
