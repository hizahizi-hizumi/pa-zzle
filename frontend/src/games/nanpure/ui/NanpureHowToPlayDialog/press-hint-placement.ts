import type {
  HowToPlayPressHintFrame,
  HowToPlayPressHintOutline,
  HowToPlayPressHintPointer,
} from "@/components/HowToPlayPressHint";

/**
 * ナンプレの例の、押す所の手がかりの置き方。マスとボタンのどちらにも同じ置き方をする。
 * メモの数字はマスの縁の近くまで並び、角にも並ぶので、枠は縁の上に引いてメモの段に入れず、指は下の縁の中央に半分を外へ出す。
 */
export const nanpurePressHintPlacement = {
  frame: "edge",
  outline: "square",
  pointer: "bottom-edge",
} as const satisfies {
  frame: HowToPlayPressHintFrame;
  outline: HowToPlayPressHintOutline;
  pointer: HowToPlayPressHintPointer;
};
