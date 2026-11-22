import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { useTouchTap } from "@/components/touch-tap";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import { SHUTTLE_PARKING_EXIT_MS } from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  listShuttleParkingCarExitSides,
  SHUTTLE_PARKING_SIDES,
  type ShuttleParkingCar,
  type ShuttleParkingCarId,
  type ShuttleParkingLot as ShuttleParkingLotDefinition,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import { ShuttleParkingCarBody } from "@/games/shuttle-parking/ui/board/ShuttleParkingCarBody";
import { shuttleParkingColorNames } from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";
import { playRejectionShake } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "@/games/shuttle-parking/ui/board/shuttle-parking-board.css";

type ShuttleParkingLotProps = {
  lot: ShuttleParkingLotDefinition;
  parkedCarIds: readonly ShuttleParkingCarId[];
  operation: ShuttleParkingOperation | null;
  interactionDisabled: boolean;
  /** 車の上に重ねる物（チュートリアルの印・遊び方の押す所の手がかり）。受け取らないときは本番と同じに描く。 */
  renderCarOverlay?: (carId: ShuttleParkingCarId) => ReactNode;
  onExitCar: (carId: ShuttleParkingCarId) => void;
};

/** 駐車場の外周に、出口の道路か壁を描く半マスの帯を取る。 */
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
  top: "inset-x-(--band) top-0 h-(--band)",
  right: "inset-y-(--band) right-0 w-(--band)",
  bottom: "inset-x-(--band) bottom-0 h-(--band)",
  left: "inset-y-(--band) left-0 w-(--band)",
} as const satisfies Record<ShuttleParkingSide, string>;

const exitArrowRotations = {
  top: "rotate-0",
  right: "rotate-90",
  bottom: "rotate-180",
  left: "-rotate-90",
} as const satisfies Record<ShuttleParkingSide, string>;

/** 出ていく車が、出口の道路の外まで走り抜ける移動。車自身の大きさに対する割合で返す。 */
function getExitTranslation(
  lot: ShuttleParkingLotDefinition,
  car: ShuttleParkingCar,
  side: ShuttleParkingSide,
): { x: string; y: string } {
  const length = car.capacity;
  const beyond = roadBandCells + length;
  const cells = {
    top: car.row + beyond,
    bottom: lot.size - car.row - length + beyond,
    left: car.column + beyond,
    right: lot.size - car.column - length + beyond,
  }[side];
  const ratio = `${((cells / length) * 100).toFixed(2)}%`;
  const negative = `-${ratio}`;
  switch (side) {
    case "top":
      return { x: "0%", y: negative };
    case "bottom":
      return { x: "0%", y: ratio };
    case "left":
      return { x: negative, y: "0%" };
    case "right":
      return { x: ratio, y: "0%" };
  }
}

function findFront(
  lot: ShuttleParkingLotDefinition,
  car: ShuttleParkingCar,
): ShuttleParkingSide {
  return (
    listShuttleParkingCarExitSides(lot, car)[0] ??
    (car.orientation === "vertical" ? "top" : "right")
  );
}

function describeCar(
  car: ShuttleParkingCar,
  front: ShuttleParkingSide,
): string {
  const direction = { top: "上", right: "右", bottom: "下", left: "左" }[front];
  return `${shuttleParkingColorNames[car.color]}の${car.capacity}人乗りの車 ${direction}向き`;
}

const blockedShakeKeyframes = {
  horizontal: [
    { transform: "translateX(0)" },
    { transform: "translateX(-5%)" },
    { transform: "translateX(5%)" },
    { transform: "translateX(0)" },
  ],
  vertical: [
    { transform: "translateY(0)" },
    { transform: "translateY(-5%)" },
    { transform: "translateY(5%)" },
    { transform: "translateY(0)" },
  ],
} as const;

const blockerFlashKeyframes = [
  { outlineColor: "rgb(255 255 255 / 0)" },
  { outlineColor: "rgb(255 255 255 / 0.95)" },
  { outlineColor: "rgb(255 255 255 / 0)" },
];

/**
 * 駐車場。開いた辺は出口の道路として矢印で、閉じた辺は壁として描く。車は前の端に進む向きの矢印を付ける。
 * 押す範囲は車の占めるマス全体。出た車は、待機枠へ移る間だけ出口へ走り抜ける姿で残す。
 * 進路を塞がれた車を押すと、その車を揺らし、塞いでいる車の縁を光らせる。
 */
export function ShuttleParkingLot({
  lot,
  parkedCarIds,
  operation,
  interactionDisabled,
  renderCarOverlay,
  onExitCar,
}: ShuttleParkingLotProps) {
  const { getTapHandlers } = useTouchTap();
  const carRefs = useRef(new Map<ShuttleParkingCarId, HTMLElement>());
  const band = toPercent(roadBandCells, lot.size);
  const exitingCar =
    operation?.type === "exited" ? lot.cars[operation.carId] : undefined;

  useEffect(() => {
    if (operation?.type !== "blocked") return;
    const car = lot.cars[operation.carId];
    if (!car) return;
    playRejectionShake(
      carRefs.current.get(operation.carId),
      [...blockedShakeKeyframes[car.orientation]],
      { durationMs: 240, easing: "ease-in-out" },
    );
    if (operation.reason !== "path-blocked") return;
    for (const blockerId of operation.blockerIds) {
      playRejectionShake(
        carRefs.current.get(blockerId),
        blockerFlashKeyframes,
        { durationMs: 480, easing: "ease-in-out" },
      );
    }
  }, [operation, lot.cars]);

  return (
    <div
      role="group"
      aria-label={`${SHUTTLE_PARKING_DISPLAY_NAME}の駐車場`}
      className="relative aspect-square w-full touch-manipulation select-none overflow-hidden rounded-lg bg-[#3f4347] dark:bg-[#2c2f33]"
      style={{ "--band": band } as CSSProperties}
    >
      {SHUTTLE_PARKING_SIDES.filter((side) => lot.openSides.includes(side)).map(
        (side) => (
          <div
            key={side}
            data-exit-side={side}
            aria-hidden="true"
            className={cn(
              "absolute flex items-center justify-around bg-[#5b6066] dark:bg-[#454a50]",
              sideBandClassNames[side],
              (side === "left" || side === "right") && "flex-col",
            )}
          >
            {Array.from({ length: lot.size }, (_, index) => (
              <svg
                // biome-ignore lint/suspicious/noArrayIndexKey: 印は位置で決まる
                key={index}
                viewBox="0 0 10 10"
                className={cn(
                  "size-[38%] max-h-3 max-w-3 fill-white/75",
                  exitArrowRotations[side],
                )}
                style={
                  side === "left" || side === "right"
                    ? { width: "60%", height: "auto" }
                    : { height: "60%", width: "auto" }
                }
              >
                <path d="M5 1.5 9 8H1Z" />
              </svg>
            ))}
          </div>
        ),
      )}
      <div
        aria-hidden="true"
        className="absolute bg-[#dcd8cf] dark:bg-[#4b4943]"
        style={{
          inset: band,
          backgroundImage:
            "linear-gradient(to right, rgb(0 0 0 / 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.1) 1px, transparent 1px)",
          backgroundSize: `${100 / lot.size}% ${100 / lot.size}%`,
        }}
      />
      {lot.cars.map((car, carId) => {
        if (!parkedCarIds.includes(carId)) return null;
        const front = findFront(lot, car);
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 車の ID は駐車場の並びの位置
            key={carId}
            ref={(element) => {
              if (element) carRefs.current.set(carId, element);
              else carRefs.current.delete(carId);
            }}
            type="button"
            data-car-id={carId}
            aria-label={describeCar(car, front)}
            disabled={interactionDisabled}
            className="absolute flex items-center justify-center rounded-[0.5rem] p-[3px] outline-2 outline-transparent outline-offset-[-1px] focus-visible:outline-ring disabled:cursor-default"
            style={getCarBox(car, lot.size)}
            {...getTapHandlers(() => onExitCar(carId))}
          >
            <ShuttleParkingCarBody
              car={car}
              orientation={car.orientation}
              front={front}
              seatedCount={0}
            />
            {renderCarOverlay?.(carId)}
          </button>
        );
      })}
      {exitingCar && operation?.type === "exited" ? (
        <span
          key={operation.id}
          aria-hidden="true"
          className="shuttle-parking-exiting-car pointer-events-none absolute p-[3px]"
          style={
            {
              ...getCarBox(exitingCar, lot.size),
              "--exit-x": getExitTranslation(lot, exitingCar, operation.side).x,
              "--exit-y": getExitTranslation(lot, exitingCar, operation.side).y,
              "--exit-ms": `${SHUTTLE_PARKING_EXIT_MS}ms`,
            } as CSSProperties
          }
        >
          <ShuttleParkingCarBody
            car={exitingCar}
            orientation={exitingCar.orientation}
            front={operation.side}
            seatedCount={0}
          />
        </span>
      ) : null}
    </div>
  );
}
