import type { ReactNode } from "react";

import { HowToPlayExampleResetButton } from "@/components/HowToPlayExampleResetButton";

type HowToPlayGoalFrameProps = {
  /** ゴールの盤面。読み上げの名前は盤面の側で付ける。 */
  board: ReactNode;
  /** 動きを見せている途中か。途中の間だけ、盤面に重ねる透明なボタンで、押すと最後の姿へ飛ばせる。 */
  skippable: boolean;
  /** 盤面に重ねる、最後の姿へ飛ばすボタンの名前。 */
  skipLabel: string;
  onSkip: () => void;
  /** 見せ直すボタンを出すか。出さない間も場所は取る。 */
  replayable: boolean;
  onReplay: () => void;
};

/**
 * 盤面の下に見せ直すボタンの段が取る高さ（px）。盤面との間（8px）と、ボタンの高さ（`icon-touch` の 36px）。
 * 広い画面で、置き場所の高さに盤面を合わせるゲームは、この高さを盤面の高さから除く。
 */
export const HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX = 44;

/**
 * 入口のゴールの盤面の外枠。盤面の右下の外に、再生の形の見せ直すボタンを置き、ボタンの右端を盤面の右端にそろえる。
 * 動きを見せている途中は盤面に透明なボタンを重ね、押すと残りを飛ばす。盤面の部品は要素を1つ置いて動くことがあるので、
 * 盤面そのものではなく重ねた面で受ける。
 * 飛ばすのは見ている途中の短い動きなので、指とマウスだけで受け、読み上げとキーボードには見せ直すボタンだけを出す。
 */
export function HowToPlayGoalFrame({
  board,
  skippable,
  skipLabel,
  onSkip,
  replayable,
  onReplay,
}: HowToPlayGoalFrameProps) {
  return (
    <div className="flex w-fit flex-col items-end gap-2">
      <div className="relative">
        {board}
        {skippable ? (
          <button
            type="button"
            aria-hidden="true"
            aria-label={skipLabel}
            tabIndex={-1}
            onClick={onSkip}
            className="absolute inset-0 cursor-pointer rounded-sm transition-colors duration-(--duration-fast) active:bg-foreground/5"
          />
        ) : null}
      </div>
      {/* ボタンの右端を、盤面の右端にそろえる。 */}
      <span className="flex">
        <HowToPlayExampleResetButton
          action="replay"
          changed={replayable}
          label="始まりの盤面から見せ直す"
          onPress={onReplay}
        />
      </span>
    </div>
  );
}
