import type { ReactNode } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinishAction,
  type TutorialRuleChip,
  TutorialScreen,
} from "@/components/TutorialOverlay/TutorialScreen";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { TutorialMessage } from "@/games/tutorial";

export type {
  TutorialBoardIntro,
  TutorialFinishAction,
  TutorialRuleChip,
} from "@/components/TutorialOverlay/TutorialScreen";

type TutorialOverlayProps = {
  open: boolean;
  /** パズルの名前。チュートリアルはパズルの入口の1つなので、何のパズルかを盤面と一緒に見せる。 */
  title: string;
  /** パズル選択と同じピクトグラム。導入で名前と一緒に見せ、その後も上部で名前に添える。 */
  pictogramSvg: string;
  rules: readonly TutorialRuleChip[];
  message: TutorialMessage;
  /** 導入を見せている間。開いたときと、もう一度始めたときは導入から始まる。 */
  introducing: boolean;
  completed: boolean;
  finishAction: TutorialFinishAction;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。導入の盤面の段も盤面が受け持つ。 */
  renderBoard: (intro: TutorialBoardIntro) => ReactNode;
  /** 導入を終えたか、飛ばした。 */
  onIntroEnd: () => void;
  onRestart: () => void;
  onClose: () => void;
};

/**
 * 1つの盤面を埋めながらルールを1つずつ身につけていく全画面の枠。
 * 開くたびに中の画面を作り直し、パズルの名前と盤面の導入から始める。
 */
export function TutorialOverlay({
  open,
  title,
  pictogramSvg,
  rules,
  message,
  introducing,
  completed,
  finishAction,
  renderBoard,
  onIntroEnd,
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
        <TutorialScreen
          title={title}
          pictogramSvg={pictogramSvg}
          rules={rules}
          message={message}
          introducing={introducing}
          completed={completed}
          finishAction={finishAction}
          renderBoard={renderBoard}
          onIntroEnd={onIntroEnd}
          onRestart={onRestart}
        />
      </DialogContent>
    </Dialog>
  );
}
