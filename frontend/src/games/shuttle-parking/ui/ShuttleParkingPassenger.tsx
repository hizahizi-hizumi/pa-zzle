import type { ShuttleParkingColor } from "@/games/shuttle-parking/puzzle/lot";
import { shuttleParkingColorFills } from "@/games/shuttle-parking/ui/shuttle-parking-colors";

type ShuttleParkingPassengerProps = {
  color: ShuttleParkingColor;
  className?: string;
};

export function ShuttleParkingPassenger({
  color,
  className,
}: ShuttleParkingPassengerProps) {
  return (
    <svg
      viewBox="0 0 20 24"
      aria-hidden="true"
      className={className}
      fill={shuttleParkingColorFills[color]}
    >
      <circle cx="10" cy="6" r="5" />
      <path d="M1 23 C1 15 4.5 12.5 10 12.5 C15.5 12.5 19 15 19 23 Z" />
    </svg>
  );
}
