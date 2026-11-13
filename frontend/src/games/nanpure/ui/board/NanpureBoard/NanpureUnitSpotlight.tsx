import type { CSSProperties } from "react";

import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { NANPURE_BLOCK_SIZE, NANPURE_SIZE } from "@/games/nanpure/puzzle/board";
import type { NanpureBoardUnit } from "@/games/nanpure/ui/board/board-spotlight";

type NanpureUnitSpotlightProps = {
  unit: NanpureBoardUnit;
};

/** 絶対配置のグリッドの子は終わりの線を省くと端まで広がるため、範囲を明示する。 */
function getUnitArea({ kind, index }: NanpureBoardUnit): CSSProperties {
  switch (kind) {
    case "row":
      return {
        gridRow: `${index + 1} / span 1`,
        gridColumn: `1 / span ${NANPURE_SIZE}`,
      };
    case "column":
      return {
        gridRow: `1 / span ${NANPURE_SIZE}`,
        gridColumn: `${index + 1} / span 1`,
      };
    case "block":
      return {
        gridRow: `${Math.floor(index / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE + 1} / span ${NANPURE_BLOCK_SIZE}`,
        gridColumn: `${(index % NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE + 1} / span ${NANPURE_BLOCK_SIZE}`,
      };
  }
}

/** 行・列・ブロックを、そのマスが並ぶ角の無い四角のまま、画面全体の覆いから抜く。 */
export function NanpureUnitSpotlight({ unit }: NanpureUnitSpotlightProps) {
  return (
    <span
      aria-hidden="true"
      data-spotlit-unit={`${unit.kind}:${unit.index}`}
      className="pointer-events-none absolute inset-0"
      style={getUnitArea(unit)}
    >
      <TutorialSpotlight active={true} className="inset-0" />
    </span>
  );
}
