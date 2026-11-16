import type { ComponentProps, ReactNode, Ref } from "react";

import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { cn } from "@/lib/utils";

type MinesweeperBoardGridProps = Pick<
  ComponentProps<"div">,
  "role" | "aria-label" | "aria-hidden"
> & {
  columns: number;
  presentation?: "board" | "cover";
  /** チュートリアルが、盤面の中だけを覆う範囲にする。 */
  spotlightArea?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

const BOARD_GRID_CLASS_NAME = "grid w-full gap-[4px] p-[8px]";
const BOARD_SURFACE_CLASS_NAME =
  "rounded-[6px] bg-[#a7b2c0] shadow-[0_2px_0_#8796a8,0_8px_16px_#52657b1f,inset_0_1px_0_#f7f9fc,inset_0_-1px_0_#909fb24d] dark:bg-[#2d3a4c] dark:shadow-[0_2px_0_#172333,0_8px_16px_#04091566,inset_0_1px_0_#7b8da34a,inset_0_-1px_0_#10192680]";

export function MinesweeperBoardGrid({
  columns,
  presentation = "board",
  spotlightArea = false,
  children,
  ref,
  ...props
}: MinesweeperBoardGridProps) {
  return (
    <div
      ref={ref}
      className={cn(
        BOARD_GRID_CLASS_NAME,
        presentation === "board"
          ? BOARD_SURFACE_CLASS_NAME
          : "pointer-events-none absolute inset-0",
      )}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      {...(spotlightArea && { [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "" })}
      {...props}
    >
      {children}
    </div>
  );
}
