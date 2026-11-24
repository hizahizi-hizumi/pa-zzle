import type { ShuttleParkingColor } from "@/games/shuttle-parking/puzzle/lot";
import { ShuttleParkingPassenger } from "@/games/shuttle-parking/ui/board/ShuttleParkingPassenger";
import { shuttleParkingColorNames } from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";
import { cn } from "@/lib/utils";

type ShuttleParkingQueueProps = {
  passengers: readonly ShuttleParkingColor[];
  boardedCount: number;
};

/**
 * 乗客の列。乗った乗客も同じ場所に薄く残し、列の並びを動かさない。
 * 次に乗る先頭の乗客の下に線を引き、どこまで乗ったかを列の中で見失わないようにする。
 */
export function ShuttleParkingQueue({
  passengers,
  boardedCount,
}: ShuttleParkingQueueProps) {
  const waiting = passengers.slice(boardedCount);
  return (
    <ol
      aria-label={
        waiting.length === 0
          ? "乗客の列 全員が乗りました"
          : `乗客の列 残り${waiting.length}人 先頭から ${waiting
              .map((color) => shuttleParkingColorNames[color])
              .join(" ")}`
      }
      className="flex flex-wrap justify-center gap-x-0.5 gap-y-1"
    >
      {passengers.map((color, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: 乗客は列の位置で決まり、並び替わらない
          key={index}
          aria-hidden="true"
          data-passenger-state={
            index < boardedCount
              ? "boarded"
              : index === boardedCount
                ? "head"
                : "waiting"
          }
          className={cn(
            "flex flex-col items-center gap-0.5",
            index < boardedCount && "opacity-20",
          )}
        >
          <ShuttleParkingPassenger color={color} className="h-6 w-5" />
          <span
            className={cn(
              "h-0.5 w-4 rounded-full",
              index === boardedCount ? "bg-foreground" : "bg-transparent",
            )}
          />
        </li>
      ))}
    </ol>
  );
}
