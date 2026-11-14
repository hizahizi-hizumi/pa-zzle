import { type ReactNode, useRef } from "react";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  type TutorialRuleListItem,
  TutorialScreen,
} from "@/components/TutorialOverlay/TutorialScreen";
import {
  type TutorialMusicState,
  useTutorialMusicState,
} from "@/components/tutorial-music-state";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type {
  TutorialIntro,
  TutorialMessage,
  TutorialPhase,
} from "@/games/tutorial";

export type {
  TutorialBoardIntro,
  TutorialFinish,
  TutorialIntroScene,
  TutorialPlayStart,
  TutorialRuleListItem,
} from "@/components/TutorialOverlay/TutorialScreen";

type TutorialOverlayProps = {
  open: boolean;
  title: string;
  pictogramSvg: string;
  intro: TutorialIntro;
  rules: readonly TutorialRuleListItem[];
  message: TutorialMessage;
  phase: TutorialPhase;
  guiding: boolean;
  finish: TutorialFinish;
  renderBoard: (intro: TutorialBoardIntro) => ReactNode;
  onIntroEnd: () => void;
  onRestart: () => void;
  onClose: () => void;
};

function getMusicState(
  open: boolean,
  phase: TutorialPhase,
): TutorialMusicState {
  if (!open) {
    return "closed";
  }
  return phase === "solved" || phase === "completed" ? "solved" : "solving";
}

/**
 * ゲームのチュートリアルの画面（`games/<game>/ui/<Game>Tutorial.tsx`）は、次のようにこの枠へつなぐ。
 * - 進行は `games/tutorial.ts` の `startTutorial`・`performTutorialAction`・`finishTutorialIntro`・`completeTutorial` で進め、`phase` と、一言（`getTutorialMessage`）を渡す。
 * - `guiding` は、`phase` が `playing` で、`getTutorialSituation` の `step` があるときに `true` にする。
 * - `renderBoard` で本番の盤面部品を描く。導入の場面（`TutorialBoardIntro`）は盤面が受け持つ。
 * - `finish` は、ゲームのホームから開いたとき（`GameHomeTutorialControl` の `playStart` があるとき）は `home`、プレイ中のメニューから開いたときは `play` にする。
 */
export function TutorialOverlay({
  open,
  title,
  pictogramSvg,
  intro,
  rules,
  message,
  phase,
  guiding,
  finish,
  renderBoard,
  onIntroEnd,
  onRestart,
  onClose,
}: TutorialOverlayProps) {
  useTutorialMusicState(getMusicState(open, phase));
  const screenRef = useRef<HTMLDivElement>(null);

  // 閉じるボタンに最初のフォーカスを置くと、導入の間ずっと枠が出るので、画面そのものに置く。
  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    screenRef.current?.focus();
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
        className="top-0 left-0 flex h-svh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 pb-[env(safe-area-inset-bottom)] shadow-none sm:max-w-none"
      >
        <TutorialScreen
          ref={screenRef}
          title={title}
          pictogramSvg={pictogramSvg}
          intro={intro}
          rules={rules}
          message={message}
          introducing={phase === "intro"}
          completed={phase === "completed"}
          guiding={guiding}
          finish={finish}
          renderBoard={renderBoard}
          onIntroEnd={onIntroEnd}
          onRestart={onRestart}
        />
      </DialogContent>
    </Dialog>
  );
}
