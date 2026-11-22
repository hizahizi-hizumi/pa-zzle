import type {
  ShuttleParkingCar,
  ShuttleParkingCarId,
} from "@/games/shuttle-parking/puzzle/lot";
import type { ShuttleParkingWaitingCar } from "@/games/shuttle-parking/puzzle/rules";
import {
  shuttleParkingColorFills,
  shuttleParkingColorNames,
} from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";

type ShuttleParkingBaysProps = {
  cars: readonly ShuttleParkingCar[];
  bayCount: number;
  waitingCars: readonly ShuttleParkingWaitingCar[];
};

function describeWaitingCar(
  car: ShuttleParkingCar,
  seatedCount: number,
): string {
  return `${shuttleParkingColorNames[car.color]}の車 ${car.capacity}席中${seatedCount}人`;
}

export function ShuttleParkingBays({
  cars,
  bayCount,
  waitingCars,
}: ShuttleParkingBaysProps) {
  const slots: (ShuttleParkingWaitingCar | null)[] = Array.from(
    { length: bayCount },
    (_, index) => waitingCars[index] ?? null,
  );
  return (
    <ul
      aria-label={`待機枠 ${bayCount}か所中${waitingCars.length}台`}
      className="flex min-w-0 flex-1 gap-1.5"
    >
      {slots.map((slot, index) => (
        <li
          key={slot ? `car-${slot.carId}` : `empty-${index}`}
          className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-md border-(length:--border-width-normal) border-dashed border-foreground/30"
        >
          {slot ? (
            <WaitingCar
              car={cars[slot.carId]!}
              carId={slot.carId}
              seatedCount={slot.seatedCount}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function WaitingCar({
  car,
  carId,
  seatedCount,
}: {
  car: ShuttleParkingCar;
  carId: ShuttleParkingCarId;
  seatedCount: number;
}) {
  return (
    <span
      role="img"
      data-car-id={carId}
      aria-label={describeWaitingCar(car, seatedCount)}
      className="flex h-8 items-center justify-center gap-1 rounded-md px-1.5"
      style={{ backgroundColor: shuttleParkingColorFills[car.color] }}
    >
      {Array.from({ length: car.capacity }, (_, seat) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 座席は位置で決まる
          key={seat}
          className={`size-3 rounded-full border-2 border-white${seat < seatedCount ? " bg-white" : ""}`}
        />
      ))}
    </span>
  );
}
