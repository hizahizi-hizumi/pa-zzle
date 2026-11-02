import type { ReactNode } from "react";

import { useTutorialFocusMode } from "@/components/tutorial-focus-mode";
import { cn } from "@/lib/utils";

type TutorialSubduableProps = {
  /** `true` の間、一段沈める。手を引いている間に、元の明るさで残す物（DESIGN.md「チュートリアルの印」）のほかの盤面の物へ渡す。 */
  subdued: boolean;
  /** 盤面の物（マス・タイルなど）の中身。この要素いっぱいに描く。 */
  children: ReactNode;
};

/**
 * 沈めた物の不透明度。盤面の状態はまだ読めるが、元の明るさのままの次に押す所と決め手から明らかに退く程度にする。
 * 覆いを重ねて穴を空けると Safari で崩れやすいので、物そのものの不透明度だけを下げる。
 */
const subduedClassName = "opacity-40";

/**
 * チュートリアルで手を引いている間に、盤面の物を一段沈める・元の明るさへ戻す。`DESIGN.md` の「チュートリアルの印」の見せ方を全ゲームで共有する。
 * どれを沈めるかは各ゲームが決めて渡す。動きを減らす設定では、移らずに切り替える。
 * 画面全体に覆いを重ねる見せ方（`screen`）では、覆いが沈める役を受け持つので、物そのものは沈めない。
 */
export function TutorialSubduable({
  subdued,
  children,
}: TutorialSubduableProps) {
  const focusMode = useTutorialFocusMode();
  return (
    <span
      data-tutorial-subdued={subdued || undefined}
      className={cn(
        "block size-full transition-opacity duration-(--duration-normal) ease-standard motion-reduce:transition-none",
        subdued && focusMode === "board" && subduedClassName,
      )}
    >
      {children}
    </span>
  );
}
