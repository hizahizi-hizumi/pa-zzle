import { type ReactNode, useRef } from "react";

import {
  type TutorialMusicState,
  useTutorialMusicState,
} from "@/components/app-background-music";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  type TutorialRuleListItem,
  TutorialScreen,
} from "@/components/TutorialOverlay/TutorialScreen";
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
  /** パズルの名前。チュートリアルはパズルの入口の1つなので、何のパズルかを盤面と一緒に見せる。 */
  title: string;
  /** パズル選択と同じピクトグラム。導入で名前と一緒に見せ、その後も上部で名前に添える。 */
  pictogramSvg: string;
  /** 操作より先に見せる、何をするパズルかの一文と、ゴール・始まりの盤面に添える一言。 */
  intro: TutorialIntro;
  rules: readonly TutorialRuleListItem[];
  message: TutorialMessage;
  /** 進行の段。開いたときと、もう一度始めたときは導入から始まる。 */
  phase: TutorialPhase;
  /** 手を引いている間。この間だけ、画面全体に覆いを重ね、次に押す所・決め手・一言を抜いて見せる。 */
  guiding: boolean;
  finish: TutorialFinish;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。導入の盤面の段も盤面が受け持つ。 */
  renderBoard: (intro: TutorialBoardIntro) => ReactNode;
  /** 解いている間だけ盤面の下に置く、ゲーム固有の操作（本番で盤の下の帯に置く操作）。導入の間と終えた後は出さない。 */
  controls?: ReactNode;
  /** 導入を終えた。 */
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
 * 1つの盤面を埋めながらルールを1つずつ身につけていく全画面の枠。
 * 開くたびに中の画面を作り直し、パズルの名前、何をするパズルか、ゴールと始まりの盤面を見せる導入から始める。
 *
 * ゲームのチュートリアルの画面（`games/<game>/ui/<Game>Tutorial.tsx`）は、次のようにこの枠へつなぐ。
 * - 進行は `games/tutorial.ts` の `startTutorial`・`performTutorialAction`・`finishTutorialIntro`・`completeTutorial` で進め、`phase` と、一言（`getTutorialMessage`）を渡す。
 * - `guiding` は、`phase` が `playing` で、`getTutorialSituation` の `step` があるときに `true` にする。
 * - `renderBoard` で本番の盤面部品を描き、次に押す所と決め手に `TutorialSpotlight`、印と合図に `TutorialCue` を置く。導入の場面（`TutorialBoardIntro`）は盤面が受け持つ。
 * - 本番で盤の下の帯に置く操作（入力の切り替えなど）は `controls` で渡し、印と抜きは盤面と同じく重ねる。
 * - `finish` は、ゲームのホームから開いたとき（`GameHomeTutorialControl` の `playStart` があるとき）は `home`、プレイ中のメニューから開いたときは `play` にする。
 * - ゲームのホームへは `GameHomeScreen` の `renderTutorial`、プレイ中のメニューへは `GamePlayFrame` の `renderTutorial` で渡す。
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
  controls,
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
          controls={controls}
          onIntroEnd={onIntroEnd}
          onRestart={onRestart}
        />
      </DialogContent>
    </Dialog>
  );
}
