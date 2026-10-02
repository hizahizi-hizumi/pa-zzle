import { ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";

type TakuzuHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * ルールと操作を、盤面と同じ見え方の小さな図と短い一文で示す。
 */
export function TakuzuHowToPlayDialog({
  open,
  onClose,
}: TakuzuHowToPlayDialogProps) {
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
          <DialogDescription>
            すべてのマスを四角か丸で埋める。
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-5 text-supporting">
          <li className="space-y-2">
            <p>各行・各列の四角と丸は同じ数。</p>
            <HowToPlayFigure rows={["abaabbab"]} />
          </li>
          <li className="space-y-2">
            <p>同じものは3つ以上続けない。</p>
            <div className="flex items-center gap-3">
              <HowToPlayFigure rows={["aab"]} />
              <Check className="size-4 text-muted-foreground" aria-hidden />
              <HowToPlayFigure rows={["aaa"]} violation="run" />
              <X className="size-4 text-muted-foreground" aria-hidden />
            </div>
          </li>
          <li className="space-y-2">
            <p>同じ並びの行・列は作れない。</p>
            <div className="flex items-center gap-3">
              <HowToPlayFigure
                rows={["abaabbab", "abaabbab"]}
                violation="line"
              />
              <X className="size-4 text-muted-foreground" aria-hidden />
            </div>
          </li>
          <li className="space-y-2">
            <p>タップで 空き → 四角 → 丸 → 空き。</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <HowToPlayFigure rows={["."]} />
              <ArrowRight className="size-4" aria-hidden />
              <HowToPlayFigure rows={["a"]} />
              <ArrowRight className="size-4" aria-hidden />
              <HowToPlayFigure rows={["b"]} />
              <ArrowRight className="size-4" aria-hidden />
              <HowToPlayFigure rows={["."]} />
            </div>
          </li>
          <li className="space-y-2">
            <p>最初からあるタイルは変えられない。</p>
            <HowToPlayFigure rows={["AB"]} />
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
