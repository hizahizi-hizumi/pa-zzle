import type {
  HowToPlayPressHintFrame,
  HowToPlayPressHintOutline,
  HowToPlayPressHintPointer,
} from "@/components/HowToPlayPressHint";

/**
 * 盤面のマスと数の欄の札の、押す所の手がかりの置き方。数はマスと札の中央に、メモの数は角まで並ぶので、
 * 枠は縁の上に引いて中身にかけず、指は下の縁の中央に半分を外へ出す。
 */
export const magicSquareCellHintPlacement = {
  frame: "edge",
  outline: "rounded",
  pointer: "bottom-edge",
} as const satisfies {
  frame: HowToPlayPressHintFrame;
  outline: HowToPlayPressHintOutline;
  pointer: HowToPlayPressHintPointer;
};

/** メモの切り替えの手がかり。丸いボタンで中身が鉛筆の絵なので、丸い枠を外に引き、指は右下の角に半分を外へ出す。 */
export const magicSquareControlHintPlacement = {
  frame: "outside",
  outline: "round",
  pointer: "outside-corner",
} as const satisfies {
  frame: HowToPlayPressHintFrame;
  outline: HowToPlayPressHintOutline;
  pointer: HowToPlayPressHintPointer;
};
