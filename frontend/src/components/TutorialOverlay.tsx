import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** チュートリアルを開いた画面。終えた後の戻り先の言い方を決める。 */
export type TutorialOrigin = "difficulty-selection" | "play";

type TutorialOverlayProps = {
  open: boolean;
  gameTitle: string;
  stepCount: number;
  achievedStepCount: number;
  /** 取り組んでいるステップの指示。すべて終えたら `null`。 */
  instruction: string | null;
  origin: TutorialOrigin;
  /** ゲーム固有の盤面。 */
  children: ReactNode;
  onClose: () => void;
};

const returnLabelByOrigin = {
  "difficulty-selection": "遊んでみる",
  play: "プレイに戻る",
} as const satisfies Record<TutorialOrigin, string>;

/**
 * 小さな盤面を実際に操作してルールと操作を学ぶ全画面の枠。
 * 盤面を主役にし、指示は盤面の上に短く1つだけ出す。
 */
export function TutorialOverlay({
  open,
  gameTitle,
  stepCount,
  achievedStepCount,
  instruction,
  origin,
  children,
  onClose,
}: TutorialOverlayProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-svh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 pb-[env(safe-area-inset-bottom)] shadow-none sm:max-w-none"
      >
        <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start px-3 pt-2">
          <div />
          <div className="flex min-w-0 flex-col items-center pt-1">
            <DialogTitle className="text-play-context">
              チュートリアル
            </DialogTitle>
            <DialogDescription className="text-play-meta text-muted-foreground">
              {gameTitle}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="閉じる"
            >
              <X />
            </Button>
          </DialogClose>
        </header>

        <div className="flex shrink-0 flex-col items-center gap-4 px-4">
          <div
            role="progressbar"
            aria-label="チュートリアルの進み具合"
            aria-valuemin={0}
            aria-valuemax={stepCount}
            aria-valuenow={achievedStepCount}
            className="flex w-full max-w-xs gap-1"
          >
            {Array.from({ length: stepCount }, (_, stepIndex) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: ステップの並びは固定で、番号そのものが識別子になる。
                key={stepIndex}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-(--duration-normal)",
                  stepIndex < achievedStepCount
                    ? "bg-foreground/70"
                    : stepIndex === achievedStepCount
                      ? "bg-foreground/30"
                      : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className={cn(
              "flex min-h-12 max-w-md items-center text-balance text-center [word-break:auto-phrase]",
              instruction === null ? "text-heading" : "text-body",
            )}
          >
            {instruction ?? "完成！"}
          </p>
        </div>

        <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size]">
          <div className="relative aspect-square w-[min(100cqw,100cqh,28rem)]">
            {children}
          </div>
        </main>

        <footer className="flex h-28 shrink-0 items-center justify-center px-4 pb-2">
          {instruction === null && (
            <Button type="button" size="lg" onClick={onClose}>
              {returnLabelByOrigin[origin]}
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
