import type { ShuttleParkingColor } from "@/games/shuttle-parking/puzzle/lot";
import { ShuttleParkingPassenger } from "@/games/shuttle-parking/ui/ShuttleParkingPassenger";
import { shuttleParkingColorNames } from "@/games/shuttle-parking/ui/shuttle-parking-colors";

type ShuttleParkingQueueProps = {
  passengers: readonly ShuttleParkingColor[];
  boardedCount: number;
};

/** 乗った乗客も同じ場所に薄く残し、列の並びを動かさない。 */
export function ShuttleParkingQueue({
  passengers,
  boardedCount,
}: ShuttleParkingQueueProps) {
  const waiting = passengers.slice(boardedCount);
  return (
    <ol
      aria-label={`乗客の列 残り${waiting.length}人 先頭から ${waiting
        .map((color) => shuttleParkingColorNames[color])
        .join(" ")}`}
      className="flex flex-wrap justify-center gap-x-0.5 gap-y-1"
    >
      {passengers.map((color, index) => (
        <li
          // 乗客は列の位置で決まり、並び替わらない。
          // biome-ignore lint/suspicious/noArrayIndexKey: 位置そのものが乗客を表す
          key={index}
          aria-hidden="true"
          className={index < boardedCount ? "opacity-20" : undefined}
        >
          <ShuttleParkingPassenger color={color} className="h-6 w-5" />
        </li>
      ))}
    </ol>
  );
}
