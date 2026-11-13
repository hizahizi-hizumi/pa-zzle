import type { IceFloorMazeElementRuleId } from "@/games/ice-floor-maze/tutorial/tutorial";
import {
  IceFloorMazeCellClipPaths,
  useIceFloorMazeCellClipIds,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { IceFloorMazeCellFace } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellFace";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeElementIconProps = {
  ruleId: IceFloorMazeElementRuleId;
};

/** 一言が指す要素を、盤面と同じ絵の1マスで見せる。 */
export function IceFloorMazeElementIcon({
  ruleId,
}: IceFloorMazeElementIconProps) {
  const clipIds = useIceFloorMazeCellClipIds();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1 1"
      className="size-6 shrink-0 overflow-hidden rounded-[3px]"
    >
      <IceFloorMazeCellClipPaths ids={clipIds} />
      <rect width={1} height={1} fill={iceFloorMazeTone.ice} />
      <IceFloorMazeCellFace kind={ruleId} clipIds={clipIds} />
    </svg>
  );
}
