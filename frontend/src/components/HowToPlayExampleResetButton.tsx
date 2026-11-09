import { CirclePlay, type LucideIcon, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 小さなボタンが戻す物。どちらもプレイ画面のボタンとメニューで使っていないアイコンにし、
 * 本番の「待った」（Undo2）・「盤面を戻す」（SkipBack）・「リセット」（RotateCcw）・「別の問題」（Play）と見分けられるようにする。
 * - `reset`: 触った例を最初の姿に戻す。
 * - `replay`: 動きを最初から見せ直す。再生の形にする。
 */
export type HowToPlayExampleResetAction = "reset" | "replay";

const actions = {
  reset: { Icon: RefreshCcw, label: "例を元に戻す" },
  replay: { Icon: CirclePlay, label: "最初から見せ直す" },
} as const satisfies Record<
  HowToPlayExampleResetAction,
  { Icon: LucideIcon; label: string }
>;

type HowToPlayExampleResetButtonProps = {
  action?: HowToPlayExampleResetAction;
  /** 戻す物が最初の姿から変わっているか。変わっていない間は、場所だけを取って見せない。 */
  changed: boolean;
  /** 読み上げる名前。渡さなければ `action` の名前にする。 */
  label?: string;
  onPress: () => void;
};

/**
 * 触れる例を最初の姿に戻す、または動きを見せ直すボタン。押す物と分かるよう、枠のある 36px のボタンに 20px のアイコンを置き、
 * 押せる範囲は疑似要素で 44px 四方まで広げる（`icon-touch`）。
 * 出し入れで周りの位置を動かさないよう、変わっていない間も場所は取ったまま見せない。
 */
export function HowToPlayExampleResetButton({
  action = "reset",
  changed,
  label,
  onPress,
}: HowToPlayExampleResetButtonProps) {
  const { Icon, label: defaultLabel } = actions[action];
  return (
    <span className={changed ? "flex" : "invisible flex"}>
      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        aria-label={label ?? defaultLabel}
        disabled={!changed}
        onClick={onPress}
      >
        <Icon aria-hidden />
      </Button>
    </span>
  );
}
