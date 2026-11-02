import type { Ref } from "react";

import {
  setTutorialFocusMode,
  type TutorialFocusMode,
  useTutorialFocusMode,
} from "@/components/tutorial-focus-mode";
import { cn } from "@/lib/utils";

const modeLabels = {
  board: "盤面",
  screen: "画面全体",
} as const satisfies Record<TutorialFocusMode, string>;

/**
 * 手を引いている間の見せ方を、その場で切り替える確かめ用の小さな切り替え。チュートリアルを開いている間だけ、画面の右下に出す。
 */
export function TutorialFocusModeSwitch({
  ref,
}: {
  ref?: Ref<HTMLDivElement>;
}) {
  const mode = useTutorialFocusMode();
  return (
    <div
      ref={ref}
      role="group"
      aria-label="手を引く間の見せ方"
      className="absolute right-2 bottom-1 z-40 flex rounded-full border border-border bg-background p-0.5 text-meta shadow-raised"
    >
      {(Object.keys(modeLabels) as TutorialFocusMode[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          onClick={() => setTutorialFocusMode(option)}
          className={cn(
            "touch-manipulation rounded-full px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === option
              ? "bg-foreground text-background"
              : "text-muted-foreground",
          )}
        >
          {modeLabels[option]}
        </button>
      ))}
    </div>
  );
}
