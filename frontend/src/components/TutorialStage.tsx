import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useRef } from "react";
import {
  type TutorialMusicState,
  useTutorialMusicState,
} from "@/components/app-background-music";
import type { TutorialFinish } from "@/components/TutorialOverlay";
import {
  type TutorialStageBoardIntro,
  TutorialStageScreen,
} from "@/components/TutorialStage/TutorialStageScreen";

import { Dialog, DialogPortal } from "@/components/ui/dialog";
import type {
  TutorialIntro,
  TutorialMessage,
  TutorialPhase,
} from "@/games/tutorial";

export type { TutorialStageBoardIntro } from "@/components/TutorialStage/TutorialStageScreen";

type TutorialStageProps = {
  open: boolean;
  title: string;
  /** パズル選択と同じピクトグラム。上部で名前に添える。 */
  pictogramSvg: string;
  /** 盤の周囲の地。プレイ画面と同じ地を渡し、本番と同じ場所で遊んでいると分かるようにする。 */
  background: ReactNode;
  /** 操作より先に、ゴールの盤面と一緒に見せる、何をするパズルかの一文とゴールの一言。 */
  intro: TutorialIntro;
  /** 解き終えたときに振り返る、身につけたルール。 */
  recap: readonly string[];
  message: TutorialMessage;
  phase: TutorialPhase;
  /** 入口から完成までの進み具合（0〜1）。 */
  progress: number;
  /** 入口から完成までの段の数。進み具合を「済んだ段 / 段の数」でも示す。 */
  progressStepCount: number;
  finish: TutorialFinish;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。 */
  renderBoard: (intro: TutorialStageBoardIntro) => ReactNode;
  onIntroEnd: () => void;
  onRestart: () => void;
  onClose: () => void;
};

/** チュートリアルは盤面を解く場面なので、開いている間は解く場面の曲を流し、解き終えたら曲を引いてクリア音を前に出す。 */
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
 * プレイ画面と同じ地の上で、本物の盤面を1枚、指さしと短い一言に沿って解かせる全画面の枠。
 * 画面を覆わず、盤面の色と形を本番のまま見せる。開くたびに中の画面を作り直し、ゴールの盤面を見せる入口から始める。
 *
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
  progress,
  progressStepCount,
  finish,
  renderBoard,
  onIntroEnd,
  onRestart,
  onClose,
}: TutorialStageProps) {
  useTutorialMusicState(getMusicState(open, phase));
  const screenRef = useRef<HTMLDivElement>(null);

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
            progress={progress}
            progressStepCount={progressStepCount}
            finish={finish}
            renderBoard={renderBoard}
            onIntroEnd={onIntroEnd}
            onRestart={onRestart}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
