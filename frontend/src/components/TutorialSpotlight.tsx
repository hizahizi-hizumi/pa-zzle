import { cn } from "@/lib/utils";

/** 覆いから抜く所に置く要素の印。`TutorialFocusScrim` がこの印の付いた要素を探して、その形に覆いを抜く。 */
export const TUTORIAL_SPOTLIGHT_ATTRIBUTE = "data-tutorial-spotlight";

type TutorialSpotlightProps = {
  /** `true` の間、画面全体の覆いからこの場所を抜く。 */
  active: boolean;
  /**
   * 抜く所の位置と角丸。抜く物そのものの位置・大きさ・角丸に合わせ、置き場所の要素の中に絶対配置で重ねる。
   * 覆いのためだけの余白や角丸は足さない。
   */
  className: string;
};

/**
 * チュートリアルで手を引いている間、画面全体の覆いから抜く所の形を盤面の物の中に置く。
 * 次に押す所と、その手を決める物（決め手）に置き、元の明るさで見せる。覆いは別の要素に描くので、この要素は見えない。位置・大きさ・角丸だけを `TutorialFocusScrim` が読む。
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
