import { type CSSProperties, type ReactNode, useRef } from "react";

import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";
import { useEquationGrid } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/use-equation-grid";

type GoalGroundProps = {
  children: ReactNode;
};

/** 置き場所の幅いっぱい。盤面の幅の上限（`--how-to-play-goal-board-max`）は式のマスの大きさで守り、紙は狭めない。 */
const groundStyle = { width: "100cqw" } satisfies CSSProperties;

function findSelf(ground: HTMLElement): HTMLElement {
  return ground;
}

/**
 * ゴールの盤面の下に敷く、プレイ画面と同じ方眼の紙。式のマスは地を透かして描くので、本番と同じ地の上で見せる。
 * 紙は置き場所の幅いっぱいにして例の面と左右の端をそろえ、角を面と同じに丸め、罫線を式のマスにそろえる。
 */
export function GoalGround({ children }: GoalGroundProps) {
  const groundRef = useRef<HTMLDivElement>(null);
  const grid = useEquationGrid(groundRef, findSelf);

  return (
    <div
      ref={groundRef}
      className="relative isolate flex justify-center overflow-hidden rounded-lg p-2"
      style={groundStyle}
    >
      <div className="absolute inset-0 -z-10">
        <FukumenzanGround grid={grid} />
      </div>
      {children}
    </div>
  );
}
