import { cn } from "@/lib/utils";

/** 覆いから抜く所に置く要素の印。`TutorialFocusScrim` がこの印の付いた要素を探して、その形に覆いを抜く。 */
export const TUTORIAL_SPOTLIGHT_ATTRIBUTE = "data-tutorial-spotlight";
/** 抜く所を要素の外側へ広げる量（px）。 */
export const TUTORIAL_SPOTLIGHT_PADDING_ATTRIBUTE =
  "data-tutorial-spotlight-padding";

type TutorialSpotlightProps = {
  /** `true` の間、画面全体の覆いからこの場所を抜く。 */
  active: boolean;
  /** 抜く所の位置と角丸。押す物の形に合わせ、置き場所の要素の中に絶対配置で重ねる。 */
  className: string;
  /** 抜く所を外側へ広げる量（px）。細い線など、そのままでは小さすぎる物に使う。 */
  padding?: number;
};

/**
 * 画面全体に覆いを重ねる見せ方（`screen`）で、覆いから抜く所の形を盤面の物の中に置く。
 * 覆いは別の要素に描くので、この要素は見えない。位置・大きさ・角丸だけを `TutorialFocusScrim` が読む。
 */
export function TutorialSpotlight({
  active,
  className,
  padding,
}: TutorialSpotlightProps) {
  if (!active) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      {...{
        [TUTORIAL_SPOTLIGHT_ATTRIBUTE]: "",
        [TUTORIAL_SPOTLIGHT_PADDING_ATTRIBUTE]: padding,
      }}
      className={cn("pointer-events-none absolute", className)}
    />
  );
}
