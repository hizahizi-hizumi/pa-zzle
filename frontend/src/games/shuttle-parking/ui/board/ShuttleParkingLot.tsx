import { type CSSProperties, useEffect, useRef } from "react";
import { useTouchTap } from "@/components/touch-tap";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  SHUTTLE_PARKING_SIDES,
  type ShuttleParkingCar,
  type ShuttleParkingCarId,
  type ShuttleParkingLot as ShuttleParkingLotDefinition,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  shuttleParkingColorFills,
  shuttleParkingColorNames,
} from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";
import { playRejectionShake } from "@/lib/motion";

type ShuttleParkingLotProps = {
  lot: ShuttleParkingLotDefinition;
  parkedCarIds: readonly ShuttleParkingCarId[];
  operation: ShuttleParkingOperation | null;
  interactionDisabled: boolean;
  onExitCar: (carId: ShuttleParkingCarId) => void;
};

/** 駐車場の外周に、道路か壁を描く半マスの帯を取る。 */
const roadBandCells = 0.5;

function toPercent(cells: number, size: number): string {
  return `${((cells / (size + roadBandCells * 2)) * 100).toFixed(4)}%`;
}

function getCarBox(car: ShuttleParkingCar, size: number): CSSProperties {
  const columns = car.orientation === "horizontal" ? car.capacity : 1;
  const rows = car.orientation === "vertical" ? car.capacity : 1;
  return {
    left: toPercent(roadBandCells + car.column, size),
    top: toPercent(roadBandCells + car.row, size),
    width: toPercent(columns, size),
    height: toPercent(rows, size),
  };
}

const sideBandClassNames = {
  top: "inset-x-0 top-0 h-(--band)",
  right: "inset-y-0 right-0 w-(--band)",
  bottom: "inset-x-0 bottom-0 h-(--band)",
  left: "inset-y-0 left-0 w-(--band)",
} as const satisfies Record<ShuttleParkingSide, string>;

const exitMarks = {
  top: "▲",
  right: "▶",
  bottom: "▼",
  left: "◀",
} as const satisfies Record<ShuttleParkingSide, string>;

function describeCar(car: ShuttleParkingCar): string {
  return `${shuttleParkingColorNames[car.color]}の${car.capacity}人乗りの車`;
}

const blockedShakeKeyframes = {
  horizontal: [
    { transform: "translateX(0)" },
    { transform: "translateX(-6%)" },
    { transform: "translateX(6%)" },
    { transform: "translateX(0)" },
  ],
  vertical: [
    { transform: "translateY(0)" },
    { transform: "translateY(-6%)" },
    { transform: "translateY(6%)" },
    { transform: "translateY(0)" },
  ],
} as const;

export function ShuttleParkingLot({
  lot,
  parkedCarIds,
  operation,
  interactionDisabled,
  onExitCar,
}: ShuttleParkingLotProps) {
  const { getTapHandlers } = useTouchTap();
  const carRefs = useRef(new Map<ShuttleParkingCarId, HTMLButtonElement>());
  const band = toPercent(roadBandCells, lot.size);

  useEffect(() => {
    if (operation?.type !== "blocked") return;
    const car = lot.cars[operation.carId];
    if (!car) return;
    playRejectionShake(
      carRefs.current.get(operation.carId),
      [...blockedShakeKeyframes[car.orientation]],
      { durationMs: 240, easing: "ease-in-out" },
    );
  }, [operation, lot.cars]);

  return (
    <div
      role="group"
      aria-label={`${SHUTTLE_PARKING_DISPLAY_NAME}の駐車場`}
      className="relative aspect-square w-full touch-manipulation select-none rounded-lg bg-[#5d6166] dark:bg-[#3a3d41]"
      style={{ "--band": band } as CSSProperties}
    >
      {SHUTTLE_PARKING_SIDES.map((side) =>
        lot.openSides.includes(side) ? (
          <div
            key={side}
            aria-hidden="true"
            className={`absolute flex items-center justify-around text-[0.6rem] text-white/70 ${sideBandClassNames[side]} ${side === "left" || side === "right" ? "flex-col" : ""}`}
          >
            {Array.from({ length: lot.size }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 印は位置で決まる
              <span key={index}>{exitMarks[side]}</span>
            ))}
          </div>
        ) : null,
      )}
      <div
        aria-hidden="true"
        className="absolute bg-[#d9d6cf] dark:bg-[#4c4a45]"
        style={{
          inset: band,
          backgroundImage:
            "linear-gradient(to right, rgb(0 0 0 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.12) 1px, transparent 1px)",
          backgroundSize: `${100 / lot.size}% ${100 / lot.size}%`,
        }}
      />
      {lot.cars.map((car, carId) =>
        parkedCarIds.includes(carId) ? (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 車の ID は駐車場の並びの位置
            key={carId}
            ref={(element) => {
              if (element) carRefs.current.set(carId, element);
              else carRefs.current.delete(carId);
            }}
            type="button"
            data-car-id={carId}
            aria-label={describeCar(car)}
            disabled={interactionDisabled}
            className="absolute flex items-center justify-center p-1 outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
            style={getCarBox(car, lot.size)}
            {...getTapHandlers(() => onExitCar(carId))}
          >
            <span
              className={`flex size-full items-center justify-around rounded-lg shadow-sm ${car.orientation === "vertical" ? "flex-col" : ""}`}
              style={{ backgroundColor: shuttleParkingColorFills[car.color] }}
            >
              {Array.from({ length: car.capacity }, (_, seat) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: 座席は位置で決まる
                  key={seat}
                  className="aspect-square rounded-full border-2 border-white/90"
                  style={{
                    width:
                      car.orientation === "vertical"
                        ? "34%"
                        : `${34 / car.capacity}%`,
                  }}
                />
              ))}
            </span>
          </button>
        ) : null,
      )}
    </div>
  );
}
