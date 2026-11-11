import { useId } from "react";

import {
  formatIceFloorMazePolygon,
  iceFloorMazeThinIceShardPolygons,
} from "@/games/ice-floor-maze/ui/board/cell-shapes";

/** 薄い氷の3つの破片を切り出す `clipPath` の ID。 */
export type IceFloorMazeCellClipIds = {
  thinIceShards: readonly string[];
};

/**
 * 同じ文書に盤面・遊び方の図の SVG が並ぶので、`clipPath` の ID は描く場所ごとに分ける。
 * ID は `url(#…)` に入れるので、英数字だけにする。
 */
export function useIceFloorMazeCellClipIds(): IceFloorMazeCellClipIds {
  const prefix = `ifm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return {
    thinIceShards: iceFloorMazeThinIceShardPolygons.map(
      (_, index) => `${prefix}-shard-${index}`,
    ),
  };
}

type IceFloorMazeCellClipPathsProps = {
  ids: IceFloorMazeCellClipIds;
};

/** 形の外接矩形を 0〜1 とした `clipPath`。切り出す形の大きさによらず使える。 */
export function IceFloorMazeCellClipPaths({
  ids,
}: IceFloorMazeCellClipPathsProps) {
  return (
    <defs>
      {iceFloorMazeThinIceShardPolygons.map((polygon, index) => (
        <clipPath
          key={ids.thinIceShards[index]}
          id={ids.thinIceShards[index]}
          clipPathUnits="objectBoundingBox"
        >
          <polygon points={formatIceFloorMazePolygon(polygon)} />
        </clipPath>
      ))}
    </defs>
  );
}
