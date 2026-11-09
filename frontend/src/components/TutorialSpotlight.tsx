import { cn } from "@/lib/utils";

/** 覆いから抜く所に置く要素の印。値は抜き方（`TutorialSpotlightRole`）。`TutorialFocusScrim` がこの印の付いた要素を探して、その形に覆いを抜く。 */
export const TUTORIAL_SPOTLIGHT_ATTRIBUTE = "data-tutorial-spotlight";

/**
 * 覆いの抜き方。明るさの段で、どこを押すかと、何を見るかを分ける。
 * - `target`: 次に押す所と、読む一言。覆いをすべて抜き、元の明るさで見せる。
 * - `clue`: その手を決める物（決め手）。覆いを半分だけ抜き、押す所より一段暗く見せる。
 */
export type TutorialSpotlightRole = "target" | "clue";

/** 手を引く間に画面全体へ重ねる覆いの重なり順。覆いの上に出す物（`TutorialForeground`）は、これより上に置く。 */
export const TUTORIAL_FOCUS_SCRIM_Z_INDEX = 30;

type TutorialSpotlightProps = {
  /** `true` の間、画面全体の覆いからこの場所を抜く。 */
  active: boolean;
  /** 抜き方。省くと `target`。 */
  role?: TutorialSpotlightRole;
  /**
   * 抜く所の位置と角丸。抜く物そのものの位置・大きさ・角丸に合わせ、置き場所の要素の中に絶対配置で重ねる。
   * 覆いのためだけの余白や角丸は足さない。
   */
  className: string;
};

/**
 * チュートリアルで手を引いている間、画面全体の覆いから抜く所の形を盤面の物の中に置く。
 * 次に押す所には `target`、その手を決める物（決め手）には `clue` で置き、押す所を元の明るさで、決め手を一段暗く見せる。覆いは別の要素に描くので、この要素は見えない。位置・大きさ・角丸だけを `TutorialFocusScrim` が読む。
 * 覆いは `TutorialOverlay` が手を引いている間（`guiding`）だけ描くので、盤面部品は抜く所をこの部品で示すだけにする。
 *
 * ```tsx
 * <button type="button" className="relative rounded-md">
 *   {face}
 *   <TutorialSpotlight active={spotlit} className="inset-0 rounded-md" />
 * </button>
 * ```
 */
export function TutorialSpotlight({
  active,
  role = "target",
  className,
}: TutorialSpotlightProps) {
  if (!active) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      {...{ [TUTORIAL_SPOTLIGHT_ATTRIBUTE]: role }}
      className={cn("pointer-events-none absolute", className)}
    />
  );
}
