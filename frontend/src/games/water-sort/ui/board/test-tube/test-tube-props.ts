import type { ReactNode, RefObject } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import type { TestTubeSealTiming } from "@/games/water-sort/ui/board/test-tube/seal-timing";

export type TestTubeProps = {
  contents: WaterSortBottle;
  /** 試験管ばさみで持っているとき、その柄を出す向き。 */
  heldBy?: "left" | "right";
  stoppered?: boolean;
  /** 栓を差し込む動きを呼び出し側が動かすときの、栓の要素。 */
  stopperRef?: RefObject<SVGSVGElement | null>;
  /** 注ぐ動きの中で栓を差すときに渡すと、栓が下りる前に、液がひとつの液に溶け合う光をこの時刻で見せる。 */
  sealTiming?: TestTubeSealTiming;
  /** 液に重ねる、移っている途中の液。 */
  liquidOverlay?: ReactNode;
  receivingSameReagent?: boolean;
};
