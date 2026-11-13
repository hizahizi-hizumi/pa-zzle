import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { cn } from "@/lib/utils";

type HowToPlayFigureProps = {
  /** 左から並べるボトルの中身。各ボトルは下から順の色番号。 */
  bottles: WaterSortState;
  selectedBottleIndex?: number;
};

export function HowToPlayFigure({
  bottles,
  selectedBottleIndex,
}: HowToPlayFigureProps) {
  return (
    <span
      aria-hidden="true"
      // ボトルの枠線や液面の余白は px 固定なので、高さだけを縮めず全体を縮小して盤面と同じ見え方を保つ。
      // 選んだボトルは盤面と同じく持ち上げる。注ぐ前と後の図でボトルの底の位置をそろえるため、選んでいるかによらず、持ち上げる分の高さを上に取っておく。
      className="box-content flex h-24 shrink-0 items-end gap-2 pt-(--selected-bottle-lift) [--selected-bottle-lift:--spacing(3.5)] [zoom:0.75]"
    >
      {bottles.map((contents, bottleIndex) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ボトルの並び順で決まる
          key={bottleIndex}
          className={cn(
            "relative aspect-[0.36] h-full",
            bottleIndex === selectedBottleIndex &&
              "-translate-y-(--selected-bottle-lift)",
          )}
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
