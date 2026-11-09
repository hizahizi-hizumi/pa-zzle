import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type {
  BridgesBoardCue,
  BridgesBoardSpotlight,
} from "@/games/bridges/ui/board/board-cue";
import {
  getEdgeSegment,
  getIslandCenter,
  ISLAND_RADIUS,
} from "@/games/bridges/ui/board/board-geometry";

/** 辺の印と抜く所の太さ。マス幅を 1 とした値。2本の橋の2線を収め、島の丸より細くして、どの2島の間かを読めるようにする。 */
const EDGE_BAND_WIDTH = 0.5;

type BoardRect = { x: number; y: number; width: number; height: number };

function getIslandRect(board: BridgesBoard, island: number): BoardRect {
  const { x, y } = getIslandCenter(board.islands[island]!);
  return {
    x: x - ISLAND_RADIUS,
    y: y - ISLAND_RADIUS,
    width: ISLAND_RADIUS * 2,
    height: ISLAND_RADIUS * 2,
  };
}

/** 辺の、両端の島の丸の縁から縁までを、橋の線に沿った帯にする。 */
function getEdgeRect(board: BridgesBoard, edge: number): BoardRect {
  const { start, end } = getEdgeSegment(board, edge);
  const half = EDGE_BAND_WIDTH / 2;
  return start.y === end.y
    ? {
        x: start.x,
        y: start.y - half,
        width: end.x - start.x,
        height: EDGE_BAND_WIDTH,
      }
    : {
        x: start.x - half,
        y: start.y,
        width: EDGE_BAND_WIDTH,
        height: end.y - start.y,
      };
}

/** 盤面の座標の四角を、盤面に対する割合の位置にする。 */
function toPlacementStyle(board: BridgesBoard, rect: BoardRect): CSSProperties {
  return {
    left: `${(rect.x / board.width) * 100}%`,
    top: `${(rect.y / board.height) * 100}%`,
    width: `${(rect.width / board.width) * 100}%`,
    height: `${(rect.height / board.height) * 100}%`,
  };
}

type BridgesBoardCuesProps = {
  board: BridgesBoard;
  cues: readonly BridgesBoardCue[];
  spotlight: BridgesBoardSpotlight | null;
};

/**
 * 盤面の絵の上に、チュートリアルの印・合図と、覆いから抜く所を重ねる。島は丸、辺は両端の丸の間の帯に沿わせる。
 * 印と合図は `TutorialCue`、抜く所は `TutorialSpotlight` だけで描く。置き場所には、どの島・辺かを属性で持たせる。
 */
export function BridgesBoardCues({
  board,
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
          style={toPlacementStyle(board, getIslandRect(board, island))}
        >
          <TutorialSpotlight active className="inset-0 rounded-full" />
        </span>
      ))}
      {spotlight?.edges.map((edge) => (
        <span
          key={`spotlit-edge-${edge}`}
          data-spotlit-edge={edge}
          className="absolute rounded-full"
          style={toPlacementStyle(board, getEdgeRect(board, edge))}
        >
          <TutorialSpotlight active className="inset-0 rounded-full" />
        </span>
      ))}
      {cues.map((cue) => (
        <span
          key={`${cue.kind}-${cue.edge}`}
          data-cue-edge={cue.edge}
          className="absolute rounded-full"
          style={toPlacementStyle(board, getEdgeRect(board, cue.edge))}
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
