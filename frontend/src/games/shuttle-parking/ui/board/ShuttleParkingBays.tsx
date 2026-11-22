import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";
import { SHUTTLE_PARKING_DEPART_MS } from "@/games/shuttle-parking/play/exit-timeline";
import type {
  ShuttleParkingCar,
  ShuttleParkingCarId,
} from "@/games/shuttle-parking/puzzle/lot";
import type { ShuttleParkingWaitingCar } from "@/games/shuttle-parking/puzzle/rules";
import { ShuttleParkingCarBody } from "@/games/shuttle-parking/ui/board/ShuttleParkingCarBody";
import { shuttleParkingColorNames } from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "@/games/shuttle-parking/ui/board/shuttle-parking-board.css";

type ShuttleParkingBaysProps = {
  cars: readonly ShuttleParkingCar[];
  bayCount: number;
  waitingCars: readonly ShuttleParkingWaitingCar[];
  /** 満席になって、待機枠を出ていく途中の車。 */
  departingCarId?: ShuttleParkingCarId | null;
  /** 待機枠と同じ行の、左の空きに置く操作。待機枠には重ねない。 */
  leadingAction?: ReactNode;
  /** 待機枠が埋まっていて出せなかった操作ごとに変わる値。変わるたびに待機枠を揺らす。 */
  fullNoticeKey?: number | null;
};

function describeWaitingCar(
  car: ShuttleParkingCar,
  seatedCount: number,
): string {
  return `${shuttleParkingColorNames[car.color]}の車 ${car.capacity}席中${seatedCount}人`;
}

const slideMs = 200;

/**
 * 待機枠。入った順に左から並べ、先に入った車ほど先に乗せることを並びで見せる。
 * 車が出発すると、残った車は左へ詰めて動き、どの車が残ったかを目で追えるようにする。
 */
export function ShuttleParkingBays({
  cars,
  bayCount,
  waitingCars,
  departingCarId = null,
  leadingAction,
  fullNoticeKey = null,
}: ShuttleParkingBaysProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const carElements = useRef(new Map<ShuttleParkingCarId, HTMLElement>());
  const lastLefts = useRef(new Map<ShuttleParkingCarId, number>());

  useLayoutEffect(() => {
    const lefts = new Map<ShuttleParkingCarId, number>();
    for (const [carId, element] of carElements.current) {
      const left = element.getBoundingClientRect().left;
      lefts.set(carId, left);
      const previous = lastLefts.current.get(carId);
      if (
        previous !== undefined &&
        previous !== left &&
        typeof element.animate === "function" &&
        !prefersReducedMotion()
      ) {
        element.animate(
          [
            { transform: `translateX(${previous - left}px)` },
            { transform: "translateX(0)" },
          ],
          { duration: slideMs, easing: MOTION_EASING.standard },
        );
      }
    }
    lastLefts.current = lefts;
  });

  useLayoutEffect(() => {
    if (fullNoticeKey === null) return;
    const list = listRef.current;
    if (typeof list?.animate !== "function" || prefersReducedMotion()) return;
    list.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 240, easing: "ease-in-out" },
    );
  }, [fullNoticeKey]);

  const columns: CSSProperties = {
    gridTemplateColumns: `repeat(${bayCount}, minmax(0, 1fr))`,
  };
  return (
    <div className="flex items-center gap-2">
      {leadingAction}
      <div ref={listRef} className="relative min-w-0 flex-1">
        <div aria-hidden="true" className="grid gap-1.5" style={columns}>
          {Array.from({ length: bayCount }, (_, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 位置そのものが枠を表す
              key={index}
              className="h-12 rounded-md border-(length:--border-width-normal) border-dashed border-foreground/25 bg-background/40"
            />
          ))}
        </div>
        <ul
          aria-label={`待機枠 ${bayCount}か所中${waitingCars.length}台`}
          className="absolute inset-0 grid gap-1.5"
          style={columns}
        >
          {waitingCars.map(({ carId, seatedCount }) => (
            <li
              key={carId}
              ref={(element) => {
                if (element) carElements.current.set(carId, element);
                else carElements.current.delete(carId);
              }}
              data-car-id={carId}
              className={cn(
                "flex items-center px-1.5 py-1.5",
                carId === departingCarId
                  ? "shuttle-parking-departing-car"
                  : "shuttle-parking-arriving-car",
              )}
              style={
                {
                  "--depart-ms": `${SHUTTLE_PARKING_DEPART_MS}ms`,
                } as CSSProperties
              }
            >
              <ShuttleParkingCarBody
                car={cars[carId]!}
                orientation="horizontal"
                front="right"
                seatedCount={seatedCount}
                label={describeWaitingCar(cars[carId]!, seatedCount)}
                className="mx-auto max-w-24"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
