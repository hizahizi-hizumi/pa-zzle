import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";

type IceFloorMazeLookComparisonProps = {
  value: IceFloorMazeLook;
  onChange: (value: IceFloorMazeLook) => void;
};

/** 比較中も盤面・手数・経過時間は引き継ぎ、表現の違いだけを確かめる。 */
export function IceFloorMazeLookComparison({
  value,
  onChange,
}: IceFloorMazeLookComparisonProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (
          nextValue === "current" ||
          nextValue === "glacier" ||
          nextValue === "aurora" ||
          nextValue === "penguin"
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
      <ToggleGroupItem value="glacier" aria-label="氷晶の盤面">
        氷晶
      </ToggleGroupItem>
      <ToggleGroupItem value="aurora" aria-label="滑走の盤面">
        滑走
      </ToggleGroupItem>
      <ToggleGroupItem value="penguin" aria-label="ペンギンの氷原">
        氷原
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
