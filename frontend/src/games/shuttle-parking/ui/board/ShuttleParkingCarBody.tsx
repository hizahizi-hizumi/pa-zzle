import type {
  ShuttleParkingCar,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import { shuttleParkingColorFills } from "@/games/shuttle-parking/ui/board/shuttle-parking-colors";
import { cn } from "@/lib/utils";

type ShuttleParkingCarBodyProps = {
  car: Pick<ShuttleParkingCar, "capacity" | "color">;
  /** 車の向き。駐車場では車の向き、待機枠では横に寝かせて描く。 */
  orientation: ShuttleParkingCar["orientation"];
  /** 前（出ていく側）の辺。窓と矢印をこの端に描く。 */
  front: ShuttleParkingSide;
  seatedCount: number;
  /** 渡すと、車1台の絵として読み上げる名前にする。押せる物の中に描くときは渡さない。 */
  label?: string;
  className?: string;
};

const flexDirections = {
  top: "flex-col",
  bottom: "flex-col-reverse",
  left: "flex-row",
  right: "flex-row-reverse",
} as const satisfies Record<ShuttleParkingSide, string>;

const frontArrowRotations = {
  top: "rotate-0",
  right: "rotate-90",
  bottom: "rotate-180",
  left: "-rotate-90",
} as const satisfies Record<ShuttleParkingSide, string>;

/**
 * 車1台の姿。前の端に窓と進む向きの矢印を置き、残りに座席を定員の数だけ並べる。
 * 座席は空きを暗い穴、乗った席を穴に座った白い人の形で描き、色によらず同じ見分け方にする。
 */
export function ShuttleParkingCarBody({
  car,
  orientation,
  front,
  seatedCount,
  label,
  className,
}: ShuttleParkingCarBodyProps) {
  const vertical = orientation === "vertical";
  return (
    <span
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      className={cn(
        "flex size-full items-center rounded-[0.4rem] shadow-[0_1px_2px_rgb(0_0_0/0.35)]",
        flexDirections[front],
        className,
      )}
      style={{ backgroundColor: shuttleParkingColorFills[car.color] }}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[0.3rem] bg-white/45",
          vertical
            ? "mx-[14%] mt-[6%] mb-[2%] h-[18%] w-[72%]"
            : "my-[14%] ml-[6%] mr-[2%] h-[72%] w-[18%]",
          front === "bottom" && "mt-[2%] mb-[6%]",
          front === "right" && "ml-[2%] mr-[6%]",
        )}
      >
        <svg
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={cn(
            "size-[70%] max-h-3 max-w-3 fill-black/55",
            frontArrowRotations[front],
          )}
        >
          <path d="M5 1.5 9 8H1Z" />
        </svg>
      </span>
      <span
        className={cn(
          "flex min-h-0 min-w-0 flex-1 items-center justify-around self-stretch",
          vertical ? "flex-col" : "flex-row",
          flexDirections[front].includes("reverse") &&
            (vertical ? "flex-col-reverse" : "flex-row-reverse"),
        )}
      >
        {Array.from({ length: car.capacity }, (_, seat) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 座席は位置で決まる
            key={seat}
            className="relative aspect-square overflow-hidden rounded-full bg-black/25"
            style={vertical ? { width: "46%" } : { height: "46%" }}
          >
            {seat < seatedCount ? (
              // 乗った席には、列と同じ人の形を白で描き、空いた席（暗い穴）と取り違えないようにする。
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="shuttle-parking-seat-filled absolute inset-[8%] fill-white"
              >
                <circle cx="10" cy="7" r="4.5" />
                <path d="M2 20C2 14 5.5 12.5 10 12.5S18 14 18 20Z" />
              </svg>
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}
