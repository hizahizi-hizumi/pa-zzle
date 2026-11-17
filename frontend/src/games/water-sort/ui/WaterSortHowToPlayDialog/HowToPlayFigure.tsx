import { WATER_SORT_BOTTLE_ASPECT_RATIO } from "@/games/water-sort/ui/board/WaterSortBoard";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import {
  getBottleRowGap,
  getBottleRowWidth,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/bottle-size";
import type { WaterSortHowToPlayFrame } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { cn } from "@/lib/utils";

type HowToPlayFigureProps = {
  frame: WaterSortHowToPlayFrame;
};

/**
 * 押せない図。本番と同じボトルを1段に並べ、ボトルの幅は置き場所が `--water-sort-figure-bottle` で決める。ボトルの間は遊び方の盤面と同じにする。
 * 注ぐ元は、本番の選んだ姿と同じく持ち上げて示す。持ち上げる分は図の上へはみ出させ、図の箱をボトルの高さにそろえて、
 * 並べたコマや矢印を、ボトルの高さの中央にそろえられるようにする。
 * 押せない図なので、押す所の手がかり（破線の枠と指）は付けない。
 */
export function HowToPlayFigure({ frame }: HowToPlayFigureProps) {
  const { bottles, selectedBottleIndex } = frame;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 items-end [--selected-bottle-lift:--spacing(3.5)]"
      style={{
        width: getBottleRowWidth(bottles.length),
        gridTemplateColumns: `repeat(${bottles.length}, minmax(0, 1fr))`,
        columnGap: getBottleRowGap(bottles.length),
      }}
    >
      {bottles.map((contents, bottleIndex) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ボトルの並び順で決まる
          key={bottleIndex}
          className={cn(
            "relative",
            bottleIndex === selectedBottleIndex &&
              "-translate-y-(--selected-bottle-lift)",
          )}
          style={{ aspectRatio: WATER_SORT_BOTTLE_ASPECT_RATIO }}
        >
          <WaterBottle
            contents={contents}
            selected={bottleIndex === selectedBottleIndex}
          />
        </span>
      ))}
    </span>
  );
}
