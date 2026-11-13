import { X } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { HowToPlayTutorialButton } from "@/components/HowToPlayTutorialButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type HowToPlayDialogControl = {
  open: boolean;
  onClose: () => void;
  /**
   * 遊び方を閉じて、そのゲームのチュートリアルを開く。チュートリアルの無いゲームでは渡さない。
   * チュートリアルを終えた後の行き先は、遊び方を開いた画面からチュートリアルを開いたときと同じにする。
   */
  onOpenTutorial?: () => void;
};

type HowToPlayDialogProps = {
  open: boolean;
  /** ゲームの目的を一文で示す。 */
  description: ReactNode;
  /** ルールと操作を1項目ずつ並べる `<li>` 群。 */
  children: ReactNode;
  onClose: () => void;
  /** 渡すと、目的の一文の下に、チュートリアルを始めるボタンを置く。 */
  onOpenTutorial?: () => void;
};

export function HowToPlayDialog({
  open,
  description,
  children,
  onClose,
  onOpenTutorial,
}: HowToPlayDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 開いた直後に閉じるボタンへフォーカスを入れると、その枠が右上に大きく出るので、見出しへ置く。
  // 見出しは押す所ではないので枠を出さず、Tab で閉じるボタンへ進める。
  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    titleRef.current?.focus();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={handleOpenAutoFocus}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        {/* 箱を作らずに、見出しと項目を層の格子に並べたまま、行頭の括弧の空きを詰める。 */}
        <div className="contents [text-spacing-trim:trim-start]">
          <DialogHeader className="text-left">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle ref={titleRef} tabIndex={-1}>
                遊び方
              </DialogTitle>
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
            <DialogDescription>{description}</DialogDescription>
            {onOpenTutorial ? (
              <div className="pt-2">
                <HowToPlayTutorialButton onOpenTutorial={onOpenTutorial} />
              </div>
            ) : null}
          </DialogHeader>

          <ol className="space-y-5 text-supporting">{children}</ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
