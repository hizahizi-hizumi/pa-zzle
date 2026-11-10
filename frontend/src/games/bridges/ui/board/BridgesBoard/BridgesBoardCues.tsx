import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
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
  cues: readonly BridgesBoardCue[];
  spotlight: BridgesBoardSpotlight | null;
};

/**
 * 盤面の絵の上に、チュートリアルの印・合図と、覆いから抜く所を重ねる。島は丸、辺は両端の島の間に架かる板の形
 * （角の小さく丸い帯）に沿わせる。
 * 印と合図は `TutorialCue`、抜く所は `TutorialSpotlight` だけで描く。置き場所には、どの島・辺かを属性で持たせる。
 */
export function BridgesBoardCues({
  view,
  cues,
  spotlight,
}: BridgesBoardCuesProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {spotlight?.islands.map((island) => (
        <span
          key={`spotlit-island-${island}`}
          data-spotlit-island={island}
          className="absolute rounded-full"
          style={toPlacementStyle(view, getIslandViewRect(view, island))}
        >
          <TutorialSpotlight active className="inset-0 rounded-full" />
        </span>
      ))}
      {spotlight?.edges.map((edge) => (
        <span
          key={`spotlit-edge-${edge}`}
          data-spotlit-edge={edge}
          className="absolute rounded-sm"
          style={toPlacementStyle(view, getEdgeViewBand(view, edge))}
        >
          <TutorialSpotlight active className="inset-0 rounded-sm" />
        </span>
      ))}
      {cues.map((cue) => (
        <span
          key={`${cue.kind}-${cue.edge}`}
          data-cue-edge={cue.edge}
          className="absolute rounded-sm"
          style={toPlacementStyle(view, getEdgeViewBand(view, cue.edge))}
        >
          {cue.kind === "mark" ? (
            <TutorialCue kind="mark" recallId={cue.recallId} />
          ) : (
            <TutorialCue kind="acknowledgement" id={cue.id} />
          )}
        </span>
      ))}
    </div>
  );
}
