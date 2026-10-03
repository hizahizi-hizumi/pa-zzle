import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TutorialMessage } from "@/games/tutorial";

/** 上部に並べるルール。手に入れるまでは中身を伏せる。 */
export type TutorialRuleChip = {
  id: string;
  label: string;
  earned: boolean;
};

/** 終えたときの主な操作。どこへ進むかは開いた側が決める。 */
export type TutorialFinishAction = {
  label: string;
  onSelect: () => void;
};

type TutorialOverlayProps = {
  open: boolean;
  gameTitle: string;
  rules: readonly TutorialRuleChip[];
  message: TutorialMessage;
  completed: boolean;
  finishAction: TutorialFinishAction;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。 */
  children: ReactNode;
  onRestart: () => void;
  onClose: () => void;
};

/**
 * 小さなパズルを順に解きながらルールを見つけていく全画面の枠。
 * 盤面を主役にし、上部に手に入れたルール、盤面の直上に短い一言だけを出す。
 */
export function TutorialOverlay({
  open,
  gameTitle,
  rules,
  message,
  completed,
  finishAction,
  children,
  onRestart,
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
        <DialogTitle className="sr-only">チュートリアル</DialogTitle>
        <DialogDescription className="sr-only">{gameTitle}</DialogDescription>
        <header className="flex min-h-14 shrink-0 items-center gap-2 pt-2 pr-3 pl-4">
          <ul
            aria-label="見つけたルール"
            className="flex min-w-0 flex-1 flex-wrap gap-1.5"
          >
            {rules.map(function renderRuleChip(rule) {
              return (
                <li key={rule.id} className="flex">
                  {rule.earned ? (
                    // 手に入れた瞬間だけ現れる動きを付けるため、伏せたチップと別の要素にして作り直す。
                    <span
                      key="earned"
                      className="flex animate-in fade-in-0 zoom-in-75 duration-300 ease-(--ease-enter) motion-reduce:animate-none"
                    >
                      <Badge variant="secondary">{rule.label}</Badge>
                    </span>
                  ) : (
                    <Badge key="hidden" variant="outline">
                      ？
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
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

        <div
          aria-live="polite"
          className="flex min-h-20 shrink-0 flex-col items-center justify-end px-4"
        >
          <p
            key={`${message.headline}\n${message.detail ?? ""}`}
            className="flex animate-in flex-col items-center gap-0.5 text-balance text-center duration-300 ease-(--ease-enter) fade-in-0 slide-in-from-bottom-1 [word-break:auto-phrase] motion-reduce:animate-none"
          >
            <span className="text-heading">{message.headline}</span>
            <span className="min-h-5 text-muted-foreground text-supporting">
              {message.detail}
            </span>
          </p>
        </div>

        <main className="flex min-h-0 flex-1 justify-center px-4 pt-6 pb-2 [container-type:size]">
          {children}
        </main>

        <footer className="flex h-28 shrink-0 items-center justify-center gap-2 px-4 pb-2">
          {completed && (
            <>
              <Button type="button" size="lg" onClick={finishAction.onSelect}>
                {finishAction.label}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onRestart}
              >
                もう一度
              </Button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
