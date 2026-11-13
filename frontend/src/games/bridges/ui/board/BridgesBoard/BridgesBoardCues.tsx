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
  /** 印の太さを、その盤面で押せば架かる板の影にそろえる。 */
  compact: boolean;
};

/**
 * 辺の印は両端の島の間に架かる板の形（角の小さく丸い帯）に沿わせ、盤面が押せば架かる辺に置く板の影と同じ太さにする。
 * 抜く所は、島の丸と、辺の帯（両端の島の間に架かる板の幅）にする。
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
            cue.pointed ? (
              // 板の帯は細く、下の縁の外には島や別の帯が詰まるので、指は帯の中に置く。
              <TutorialCue
                kind="pointer"
                recallId={cue.recallId}
                placement="center"
              />
            ) : (
              <TutorialCue kind="mark" recallId={cue.recallId} />
            )
          ) : (
            <TutorialCue kind="acknowledgement" id={cue.id} />
          )}
        </span>
      ))}
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
    </div>
  );
}
