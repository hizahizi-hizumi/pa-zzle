import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";

import type {
  ParkingJamDirection,
  ParkingJamOrientation,
} from "@/games/parking-jam/puzzle/board";

type ParkingJamDirectionControlsProps = {
  orientation: ParkingJamOrientation | null;
  feedback: "blocked" | "exited" | null;
  disabled: boolean;
  onDirection: (direction: ParkingJamDirection) => void;
};

type DirectionDefinition = {
  direction: ParkingJamDirection;
  label: string;
  icon: LucideIcon;
};

const horizontalDirections: readonly DirectionDefinition[] = [
  { direction: "left", label: "左へ出庫", icon: ArrowLeft },
  { direction: "right", label: "右へ出庫", icon: ArrowRight },
];

const verticalDirections: readonly DirectionDefinition[] = [
  { direction: "up", label: "上へ出庫", icon: ArrowUp },
  { direction: "down", label: "下へ出庫", icon: ArrowDown },
];

function getFeedbackMessage(
  feedback: ParkingJamDirectionControlsProps["feedback"],
): string {
  if (feedback === "blocked") return "そこからは出せません";
  if (feedback === "exited") return "出庫しました";
  return "";
}

export function ParkingJamDirectionControls({
  orientation,
  feedback,
  disabled,
  onDirection,
}: ParkingJamDirectionControlsProps) {
  const directions =
    orientation === "horizontal"
      ? horizontalDirections
      : orientation === "vertical"
        ? verticalDirections
        : [];
  const feedbackMessage = getFeedbackMessage(feedback);

  return (
    <div className="grid h-full grid-rows-[1.5rem_1fr] items-center justify-items-center">
      <p
        aria-live="polite"
        className="text-xs font-medium text-muted-foreground"
      >
        {feedbackMessage ||
          (orientation ? "出す方向を選んでください" : "車を選んでください")}
      </p>

      <div className="flex items-center justify-center gap-4">
        {directions.map(({ direction, label, icon: Icon }) => (
          <button
            key={direction}
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={() => onDirection(direction)}
            className="inline-flex size-14 items-center justify-center rounded-full border-2 border-border bg-background text-foreground shadow-sm outline-none transition-[transform,background-color,border-color] hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-45 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/30"
          >
            <Icon className="size-7" strokeWidth={2.2} />
          </button>
        ))}
      </div>
    </div>
  );
}
