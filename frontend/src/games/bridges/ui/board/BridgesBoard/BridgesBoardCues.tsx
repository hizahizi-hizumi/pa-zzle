import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { getGhostBridgeWidth } from "@/games/bridges/ui/board/BridgesFigure";
import type {
  BridgesBoardCue,
  BridgesBoardSpotlight,
} from "@/games/bridges/ui/board/board-cue";
import {
  type BoardRect,
  type BoardView,
  getEdgeViewBand,
  getIslandViewRect,
} from "@/games/bridges/ui/board/board-geometry";

/** 絵の座標の四角を、盤面に対する割合の位置にする。 */
function toPlacementStyle(view: BoardView, rect: BoardRect): CSSProperties {
  return {
    left: `${(rect.x / view.width) * 100}%`,
    top: `${(rect.y / view.height) * 100}%`,
    width: `${(rect.width / view.width) * 100}%`,
    height: `${(rect.height / view.height) * 100}%`,
  };
}

type BridgesBoardCuesProps = {
  view: BoardView;
  bridges: readonly BridgeCount[];
  cues: readonly BridgesBoardCue[];
  spotlight: BridgesBoardSpotlight | null;
  /** マスが小さい盤面か。印の太さを、その盤面で押せば架かる板の影にそろえる。 */
  compact: boolean;
};

/**
 * 盤面の絵の上に、チュートリアルの印・合図と、覆いから抜く所を重ねる。辺の印は両端の島の間に架かる板の形
 * （角の小さく丸い帯）に沿わせ、盤面が押せば架かる辺に置く板の影と同じ太さにし、別の形を足さない。
 * 覆いからは盤面の海を丸ごと抜き、海を灰色に濁らせない。元の明るさで見せる島と辺は、盤面の絵が海の中で絞る（`focus`）。
 * 印と合図は `TutorialCue`、抜く所は `TutorialSpotlight` だけで描く。置き場所には、どの島・辺かを属性で持たせる。
 */
export function BridgesBoardCues({
  view,
  bridges,
  cues,
  spotlight,
  compact,
}: BridgesBoardCuesProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {cues.map((cue) => (
        <span
          key={`${cue.kind}-${cue.edge}`}
          data-cue-edge={cue.edge}
          className="absolute rounded-sm"
          style={toPlacementStyle(
            view,
            getEdgeViewBand(
              view,
              cue.edge,
              getGhostBridgeWidth(bridges[cue.edge]!, compact),
            ),
          )}
        >
          {cue.kind === "mark" ? (
            <TutorialCue kind="mark" recallId={cue.recallId} />
          ) : (
            <TutorialCue kind="acknowledgement" id={cue.id} />
          )}
        </span>
      ))}
      {spotlight && <TutorialSpotlight active className="inset-0" />}
      {spotlight?.islands.map((island) => (
        <span
          key={`spotlit-island-${island}`}
          data-spotlit-island={island}
          className="absolute rounded-full"
          style={toPlacementStyle(view, getIslandViewRect(view, island))}
        />
      ))}
      {spotlight?.edges.map((edge) => (
        <span
          key={`spotlit-edge-${edge}`}
          data-spotlit-edge={edge}
          className="absolute rounded-full"
          style={toPlacementStyle(view, getEdgeViewBand(view, edge))}
        />
      ))}
    </div>
  );
}
