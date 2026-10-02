import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

type HowToPlayFigureProps = {
  /** 左から並べるボトルの中身。各ボトルは下から順の色番号。 */
  bottles: WaterSortState;
  /** 注ぎ元として選んでいるボトルの位置。 */
  selectedBottleIndex?: number;
};

/**
 * 盤面と同じボトルを小さく並べる。
 * ボトルの枠線や液面の余白は px 固定なので、高さだけを縮めず全体を縮小して盤面と同じ見え方を保つ。
 */
export function HowToPlayFigure({
  bottles,
  selectedBottleIndex,
}: HowToPlayFigureProps) {
  return (
    <span
      aria-hidden="true"
      className="flex h-24 shrink-0 items-end gap-2 [zoom:0.75]"
    >
      {bottles.map((contents, bottleIndex) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ボトルの並び順で決まる
          key={bottleIndex}
          className="relative aspect-[0.36] h-full"
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
