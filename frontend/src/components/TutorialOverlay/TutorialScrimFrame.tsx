import { type ReactNode, useRef } from "react";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  type TutorialIntroScene,
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

export type TutorialScrimFrameProps = {
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
  staticIntroScenes?: readonly TutorialIntroScene[];
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

export function TutorialScrimFrame({
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
  staticIntroScenes,
  onIntroEnd,
  onRestart,
  onClose,
}: TutorialScrimFrameProps) {
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
        presentation="full-screen"
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
          staticIntroScenes={staticIntroScenes}
          onIntroEnd={onIntroEnd}
          onRestart={onRestart}
        />
      </DialogContent>
    </Dialog>
  );
}
