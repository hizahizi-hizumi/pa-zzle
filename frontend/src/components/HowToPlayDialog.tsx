import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HowToPlayDialogProps = {
  open: boolean;
  /** ゲームの目的を一文で示す。 */
  description: ReactNode;
  /** ルールと操作を1項目ずつ並べる `<li>` 群。 */
  children: ReactNode;
  onClose: () => void;
};

/** ゲームのルールと操作を、番号付きの短い項目で示す。 */
export function HowToPlayDialog({
  open,
  description,
  children,
  onClose,
}: HowToPlayDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>遊び方</DialogTitle>
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
        </DialogHeader>

        <ol className="space-y-5 text-supporting">{children}</ol>
      </DialogContent>
    </Dialog>
  );
}
