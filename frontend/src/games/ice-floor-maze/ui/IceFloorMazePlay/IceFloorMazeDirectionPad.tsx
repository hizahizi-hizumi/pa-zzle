import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";

import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

type IceFloorMazeDirectionPadProps = {
  disabled: boolean;
  onSlide: (direction: IceFloorMazeDirection) => void;
};

/** 逆T字形に並べる。上だけを上の段に置き、下の段に左・下・右を並べる。 */
const directionButtons = [
  {
    direction: "up",
    label: "上へ滑らせる",
    Icon: ArrowUp,
    area: "col-start-2",
  },
  {
    direction: "left",
    label: "左へ滑らせる",
    Icon: ArrowLeft,
    area: "col-start-1 row-start-2",
  },
  {
    direction: "down",
    label: "下へ滑らせる",
    Icon: ArrowDown,
    area: "col-start-2 row-start-2",
  },
  {
    direction: "right",
    label: "右へ滑らせる",
    Icon: ArrowRight,
    area: "col-start-3 row-start-2",
  },
] as const satisfies readonly {
  direction: IceFloorMazeDirection;
  label: string;
  Icon: LucideIcon;
  area: string;
}[];

/** スワイプの代わりに、押した向きへ駒を滑らせる4つのボタン。待ったと同じ大きさにする。 */
export function IceFloorMazeDirectionPad({
  disabled,
  onSlide,
}: IceFloorMazeDirectionPadProps) {
  return (
    <div className="grid grid-cols-[repeat(3,3rem)] grid-rows-[repeat(2,3rem)] gap-1">
      {directionButtons.map(({ direction, label, Icon, area }) => (
        <button
          key={direction}
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={() => onSlide(direction)}
          className={`${area} inline-flex size-12 touch-manipulation items-center justify-center rounded-full border-(length:--border-width-normal) bg-background shadow-raised transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50`}
        >
          <Icon className="size-5" />
        </button>
      ))}
    </div>
  );
}
