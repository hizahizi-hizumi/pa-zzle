import { Flag, Pointer } from "lucide-react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { cn } from "@/lib/utils";

/** 切り替えさせたい入力の印。`recallId` は `TutorialCue` の `mark` に渡す。 */
export type InputModeSwitchCue = {
  mode: MinesweeperInputMode;
  recallId: number | null;
};

type InputModeSwitchProps = {
  mode: MinesweeperInputMode;
  /** 渡さなければ、本番と同じに印を付けない。 */
  cue?: InputModeSwitchCue | null;
  /** 覆いから抜く入力。渡さなければ抜かない。 */
  spotlitMode?: MinesweeperInputMode | null;
  onChange: (mode: MinesweeperInputMode) => void;
};

const itemClassName =
  "relative h-full flex-1 gap-1.5 text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg:not([class*='size-'])]:size-5";

/** 盤面の下に置く、親指で押しやすい大きさの「開く」と「旗」の切り替え。 */
export function InputModeSwitch({
  mode,
  cue = null,
  spotlitMode = null,
  onChange,
}: InputModeSwitchProps) {
  const isFlagMode = mode === "flag";

  function handleValueChange(value: string): void {
    // 選んでいる方をもう一度押すと値が空で届くので、どちらかを選んだままにする。
    if (value === "reveal" || value === "flag") {
      onChange(value);
    }
  }

  function renderTutorialMarks(itemMode: MinesweeperInputMode) {
    return (
      <>
        <TutorialSpotlight
          active={spotlitMode === itemMode}
          className="inset-0 rounded-md"
        />
        {cue?.mode === itemMode && (
          <span
            aria-hidden="true"
            data-input-mode-cue={itemMode}
            className="pointer-events-none absolute inset-0 rounded-md"
          >
            <TutorialCue kind="mark" recallId={cue.recallId} />
          </span>
        )}
      </>
    );
  }

  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label="マスを押したときの入力"
      value={mode}
      onValueChange={handleValueChange}
      className="h-10 w-[min(100%,16rem)] touch-manipulation select-none rounded-lg bg-muted p-1"
    >
      <ToggleGroupItem value="reveal" className={itemClassName}>
        <Pointer aria-hidden="true" />
        開く
        {renderTutorialMarks("reveal")}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="flag"
        className={cn(
          itemClassName,
          "data-[state=on]:text-red-600 dark:data-[state=on]:text-red-400",
        )}
      >
        <Flag aria-hidden="true" className={cn(isFlagMode && "fill-current")} />
        旗{renderTutorialMarks("flag")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
