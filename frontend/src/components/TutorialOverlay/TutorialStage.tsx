import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import {
  type TutorialMusicState,
  useTutorialMusicState,
} from "@/components/app-background-music";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import type { TutorialFinish } from "@/components/TutorialOverlay/TutorialScreen";
import {
  type TutorialStageBoardIntro,
  TutorialStageScreen,
} from "@/components/TutorialOverlay/TutorialStage/TutorialStageScreen";

import { Dialog, DialogPortal } from "@/components/ui/dialog";
import type {
  TutorialIntro,
  TutorialMessage,
  TutorialPhase,
} from "@/games/tutorial";

export type { TutorialStageBoardIntro } from "@/components/TutorialOverlay/TutorialStage/TutorialStageScreen";

export type TutorialStageProps = {
  open: boolean;
  title: string;
  /** パズル選択と同じピクトグラム。上部で名前に添える。 */
  pictogramSvg: string;
  /** 盤の周囲の地。プレイ画面と同じ地を渡す。 */
  background: ReactNode;
  intro: TutorialIntro;
  /** 解き終えたときに振り返るルール。 */
  recap: readonly string[];
  message: TutorialMessage;
  phase: TutorialPhase;
  /** 盤面が `TutorialSpotlight` で決め手を示している間 `true`。決め手を見せないゲームは渡さず、盤面を覆わない。 */
  spotlighting?: boolean;
  /** 入口から完成までの進み具合（0〜1）。 */
  progress: number;
  /** 入口から完成までの段の数。 */
  progressStepCount: number;
  finish: TutorialFinish;
  /** 盤面の大きさは盤面の側が、この領域の大きさから決める。 */
  renderBoard: (intro: TutorialStageBoardIntro) => ReactNode;
  onIntroEnd: () => void;
  onRestart: () => void;
  /** 手を離した後に手がかりを求める操作。渡している間だけ「ヒント」を出す。 */
  onRequestHint?: (() => void) | null;
  /** 渡すと上部に「遊び方」を出し、押したときにこの説明をチュートリアルの上に開く。 */
  renderHowToPlayDialog?: (control: HowToPlayDialogControl) => ReactNode;
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
 * - 進行は `games/tutorial.ts` の `startTutorial`・`performTutorialAction`・`finishTutorialIntro`・`completeTutorial` で進め、`phase` と一言を渡す。
 * - `renderBoard` で本番の盤面部品を描き、次に押す所に `TutorialCue` の `pointer` を置く。入口の場面（`TutorialStageBoardIntro`）は盤面が受け持つ。
 * - `finish` は、ゲームのホームから開いたときは `home`、プレイ中のメニューから開いたときは `play` にする。
 */
export function TutorialStage({
  open,
  title,
  pictogramSvg,
  background,
  intro,
  recap,
  message,
  phase,
  spotlighting = false,
  progress,
  progressStepCount,
  finish,
  renderBoard,
  onIntroEnd,
  onRestart,
  onRequestHint = null,
  renderHowToPlayDialog,
  onClose,
}: TutorialStageProps) {
  useTutorialMusicState(getMusicState(open, phase));
  const screenRef = useRef<HTMLDivElement>(null);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  // 閉じるボタンに最初のフォーカスを置くと、開いた直後から枠が出るので、画面そのものに置く。
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
      {/*
        プレイ画面と同じ、画面いっぱいの不透明な面にする。後ろに暗幕を敷くと、Safari が上端の色を暗幕から採るので敷かない。
      */}
      <DialogPortal>
        <DialogPrimitive.Content
          onOpenAutoFocus={handleOpenAutoFocus}
          className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-[var(--browser-surface,var(--background))] outline-none duration-(--duration-fast) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <TutorialStageScreen
            ref={screenRef}
            title={title}
            pictogramSvg={pictogramSvg}
            background={background}
            intro={intro}
            recap={recap}
            message={message}
            phase={phase}
            spotlighting={spotlighting}
            progress={progress}
            progressStepCount={progressStepCount}
            finish={finish}
            renderBoard={renderBoard}
            onIntroEnd={onIntroEnd}
            onRestart={onRestart}
            onRequestHint={onRequestHint}
            onOpenHowToPlay={
              renderHowToPlayDialog ? () => setHowToPlayOpen(true) : null
            }
          />
          {renderHowToPlayDialog?.({
            open: howToPlayOpen,
            onClose: () => setHowToPlayOpen(false),
          })}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
