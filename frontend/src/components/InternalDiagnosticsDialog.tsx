import { Check, Clipboard, Wrench, X } from "lucide-react";
import { useState } from "react";

import {
  type InternalDiagnosticItem,
  InternalDiagnosticRow,
} from "@/components/InternalDiagnosticsDialog/InternalDiagnosticRow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type InternalDiagnosticSection = {
  title: string;
  items: readonly InternalDiagnosticItem[];
};

type InternalDiagnosticsDialogProps = {
  difficultyLabel: string;
  seed: string;
  generatorVersion: string;
  generationConditions: string;
  /** 生成を試行して問題を選ぶゲームだけが渡す。 */
  generationAttempt?: number;
  buildRevision: string | null;
  /**
   * 問題の再現情報に続けて見せる、ゲーム固有の診断値のまとまり。
   * 渡すと、再現情報を含めて各まとまりに見出しを付ける。
   */
  sections?: readonly InternalDiagnosticSection[];
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
  sections = [],
  serializedSnapshot,
  onClose,
}: InternalDiagnosticsDialogProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const problemItems: InternalDiagnosticItem[] = [
    { label: "難易度", value: difficultyLabel },
    { label: "seed", value: seed, mono: true, breakAll: true },
    { label: "生成器", value: `v${generatorVersion}`, mono: true },
    { label: "生成条件", value: generationConditions },
    ...(generationAttempt === undefined
      ? []
      : [
          {
            label: "生成試行",
            value: String(generationAttempt),
            mono: true,
          },
        ]),
    {
      label: "ビルド",
      value: buildRevision ?? "取得なし",
      mono: true,
      breakAll: true,
    },
  ];
  const showsSectionTitles = sections.length > 0;
  const allSections = [{ title: "問題", items: problemItems }, ...sections];

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
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]"
      >
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

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto">
          {allSections.map((section) => (
            <section key={section.title}>
              {showsSectionTitles && (
                <h3 className="mb-2 text-meta font-semibold text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <dl className="divide-y-(length:--border-width-normal) rounded-xl border-(length:--border-width-normal) bg-muted/25 px-4">
                {section.items.map((item) => (
                  <InternalDiagnosticRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    mono={item.mono}
                    breakAll={item.breakAll}
                  />
                ))}
              </dl>
            </section>
          ))}
        </div>

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
