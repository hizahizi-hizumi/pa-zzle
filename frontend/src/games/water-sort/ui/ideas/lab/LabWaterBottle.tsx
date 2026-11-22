import { LabTestTube } from "@/games/water-sort/ui/ideas/lab/LabTestTube";
import { isSealedTube } from "@/games/water-sort/ui/ideas/lab/lab-tube-state";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";

export function LabWaterBottle({
  contents,
  selected = false,
  waterOverlay,
  role = "board",
}: WaterBottleProps) {
  return (
    <LabTestTube
      contents={contents}
      heldBy={selected ? "right" : undefined}
      stoppered={role === "board" && isSealedTube(contents)}
      liquidOverlay={waterOverlay}
    />
  );
}
