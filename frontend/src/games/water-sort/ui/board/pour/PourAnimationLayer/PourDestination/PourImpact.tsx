import { useWaterSortArt } from "@/games/water-sort/ui/art/art-registry";
import type { PourImpactProps } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourImpact/LabPourImpact";

/** 流れが液面（空なら底）に当たる所の乱れ。 */
export function PourImpact(props: PourImpactProps) {
  const { PourImpact: ArtPourImpact } = useWaterSortArt();
  return <ArtPourImpact {...props} />;
}
