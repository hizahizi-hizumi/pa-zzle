import { cn } from "@/lib/utils";

/** 覆いから抜く所に置く要素の印。`TutorialFocusScrim` がこの印の付いた要素を探して、その形に覆いを抜く。 */
export const TUTORIAL_SPOTLIGHT_ATTRIBUTE = "data-tutorial-spotlight";

/**
 * 覆う範囲にする要素の印。盤面部品が、抜く所を受け取っている間だけ盤面の要素に付ける。
 * `TutorialFocusScrim` がこの印の付いた要素の形だけを覆う。
 */
export const TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE = "data-tutorial-spotlight-area";

type TutorialSpotlightProps = {
  active: boolean;
  /**
   * 抜く所の位置と角丸。抜く物そのものの位置・大きさ・角丸に合わせ、置き場所の要素の中に絶対配置で重ねる。
   * 覆いのためだけの余白や角丸は足さない。
   */
  className: string;
};

/**
 * 次に押す所と、その手を決める物（決め手）に置き、元の明るさで見せる。覆いは別の要素に描くので、この要素は見えない。位置・大きさ・角丸だけを `TutorialFocusScrim` が読む。
 * 覆いは `TutorialOverlay` が描くので、盤面部品は抜く所をこの部品で示すだけにする。
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
  className,
}: TutorialSpotlightProps) {
  if (!active) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      {...{ [TUTORIAL_SPOTLIGHT_ATTRIBUTE]: "" }}
      className={cn("pointer-events-none absolute", className)}
    />
  );
}
