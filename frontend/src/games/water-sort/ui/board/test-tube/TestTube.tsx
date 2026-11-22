import { useWaterSortArt } from "@/games/water-sort/ui/art/art-registry";
import type { TestTubeProps } from "@/games/water-sort/ui/board/test-tube/test-tube-props";

export function TestTube(props: TestTubeProps) {
  const { TestTube: ArtTestTube } = useWaterSortArt();
  return <ArtTestTube {...props} />;
}
