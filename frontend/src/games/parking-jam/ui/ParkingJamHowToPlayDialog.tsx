import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import type { ParkingJamRoadOpening } from "@/games/parking-jam/puzzle/board";
import { HowToPlayFigure } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayFigure";

type ParkingJamHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const roadRightOfFirstLane: readonly ParkingJamRoadOpening[] = [
  { side: "right", startOffset: 0, length: 1 },
];

const roadRightOfSecondLane: readonly ParkingJamRoadOpening[] = [
  { side: "right", startOffset: 1, length: 1 },
];

const blockedFigures = [
  {
    caption: "車がある",
    rows: ["aab", "..b"],
    roadOpenings: roadRightOfFirstLane,
  },
  {
    caption: "植え込みがある",
    rows: ["aa#", "..."],
    roadOpenings: roadRightOfFirstLane,
  },
  {
    caption: "先に道路がない",
    rows: ["aa.", "..."],
    roadOpenings: roadRightOfSecondLane,
  },
] as const;

/** ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。 */
export function ParkingJamHowToPlayDialog({
  open,
  onClose,
}: ParkingJamHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="駐車場の車を、すべて道路へ出す。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          車は前か後ろへまっすぐ進む。進む先が道路につながっていれば、一度で外へ出る。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={["aa.", "..."]}
            roadOpenings={roadRightOfFirstLane}
          />
          <HowToPlayFigure
            rows={["...", "..."]}
            roadOpenings={roadRightOfFirstLane}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          途中に車や植え込みがあるときと、進む先に道路がないときは出られず、ミスに数える。
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {blockedFigures.map(({ caption, rows, roadOpenings }) => (
            <figure key={caption} className="flex flex-col items-center gap-1">
              <HowToPlayFigure rows={rows} roadOpenings={roadOpenings} />
              <figcaption className="text-meta text-muted-foreground">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </li>
      <li className="space-y-2">
        <p>
          車を出したい向きへスワイプする。車をタップすると両端に矢印が出て、矢印を押しても出せる。
        </p>
        <HowToPlayFigure
          rows={["....", ".aa."]}
          roadOpenings={roadRightOfSecondLane}
          selectedVehicleId="a"
        />
      </li>
      <li>
        <p>待ったで、直前に出した車を戻せる。</p>
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード: Tab で車へ移動、車の向きに沿う矢印キーで出す、Enter
          で両端の矢印を出す。
        </p>
      </li>
    </HowToPlayDialog>
  );
}
