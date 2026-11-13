import {
  TutorialScrimFrame,
  type TutorialScrimFrameProps,
} from "@/components/TutorialOverlay/TutorialScrimFrame";
import {
  TutorialStage,
  type TutorialStageProps,
} from "@/components/TutorialOverlay/TutorialStage";

export type {
  TutorialBoardIntro,
  TutorialFinish,
  TutorialIntroScene,
  TutorialPlayStart,
  TutorialRuleListItem,
} from "@/components/TutorialOverlay/TutorialScreen";
export type { TutorialStageBoardIntro } from "@/components/TutorialOverlay/TutorialStage";

/**
 * 見せ方ごとの props。
 * - `scrim`（既定）: 手を引く間に画面全体へ覆いを重ね、次に押す所・決め手・一言を抜いて見せる。
 * - `stage`: プレイ画面と同じ地の上で、画面を覆わずに、指さしと短い一言で手を引く。
 */
type TutorialOverlayProps =
  | (TutorialScrimFrameProps & { presentation?: "scrim" })
  | (TutorialStageProps & { presentation: "stage" });

/**
 * ゲームのチュートリアルの画面（`games/<game>/ui/<Game>Tutorial.tsx`）は、次のようにこの枠へつなぐ。
 * - 進行は `games/tutorial.ts` の `startTutorial`・`performTutorialAction`・`finishTutorialIntro`・`completeTutorial` で進め、`phase` と、一言（`getTutorialMessage`）を渡す。
 * - 見せ方は `presentation` で選ぶ。
 * - `scrim` では、`guiding` を、`phase` が `playing` で `getTutorialSituation` の `step` があるときに `true` にする。`renderBoard` で本番の盤面部品を描き、次に押す所と決め手に `TutorialSpotlight`、印と合図に `TutorialCue` を置く。導入の場面（`TutorialBoardIntro`）は盤面が受け持つ。
 * - `stage` では、プレイ画面と同じ地を `background` に渡す。`renderBoard` で本番の盤面部品を描き、次に押す所に `TutorialCue` の `pointer` を置く。入口の場面（`TutorialStageBoardIntro`）は盤面が受け持つ。
 * - `finish` は、ゲームのホームから開いたとき（`GameHomeTutorialControl` の `playStart` があるとき）は `home`、プレイ中のメニューから開いたときは `play` にする。
 */
export function TutorialOverlay(props: TutorialOverlayProps) {
  if (props.presentation === "stage") {
    return <TutorialStage {...props} />;
  }
  return <TutorialScrimFrame {...props} />;
}
