import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";

type IceFloorMazeLookComparisonProps = {
  value: IceFloorMazeLook;
  onChange: (value: IceFloorMazeLook) => void;
  disabled?: boolean;
};

/** 同じ盤面と手数を維持して、動き・衝突・一体化の違いを遊びながら比べる。 */
export function IceFloorMazeLookComparison({
  value,
  onChange,
  disabled = false,
}: IceFloorMazeLookComparisonProps) {
  return (
    <ToggleGroup
      type="single"
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => {
        if (
          nextValue === "current" ||
          nextValue === "kinetic" ||
          nextValue === "terrain" ||
          nextValue === "unified"
        ) {
          onChange(nextValue);
        }
      }}
      aria-label="盤面の表現を比較"
      variant="outline"
      size="sm"
      className="rounded-md bg-background/90 p-0.5 shadow-sm"
    >
      <ToggleGroupItem value="current" aria-label="現行の盤面">
        現行
      </ToggleGroupItem>
      <ToggleGroupItem value="kinetic" aria-label="滑走の手触り">
        滑走
      </ToggleGroupItem>
      <ToggleGroupItem value="terrain" aria-label="地形の反応">
        接触
      </ToggleGroupItem>
      <ToggleGroupItem value="unified" aria-label="滑走と接触の統合">
        統合
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
