import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayRuleMark } from "@/components/HowToPlayRuleMark";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { HowToPlayFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/HowToPlayFigure";

type WaterSortHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** 左を注ぎ元、右を注ぎ先とした2本のボトルと、そこへ注げるかどうか。 */
const pourConditionFigures: readonly {
  key: string;
  bottles: WaterSortState;
  pourable: boolean;
}[] = [
  { key: "empty", bottles: [[1, 0], []], pourable: true },
  {
    key: "same-color",
    bottles: [
      [1, 0],
      [2, 0],
    ],
    pourable: true,
  },
  {
    key: "different-color",
    bottles: [
      [1, 0],
      [2, 1],
    ],
    pourable: false,
  },
];

/** ルールと操作を、盤面と同じボトルの小さな図と短い一文で示す。 */
export function WaterSortHowToPlayDialog({
  open,
  onClose,
}: WaterSortHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="液体を注ぎ分けて、どの色も1本のボトルにそろえる。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          注ぎ元のボトルを押して選び、注ぎ先のボトルを押して注ぐ。選んだボトルをもう一度押すと選び直せる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure bottles={[[1, 0], []]} selectedBottleIndex={0} />
          <HowToPlayFigure bottles={[[1], [0]]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>上に続く同じ色は、入るだけまとめて移る。</p>
        <HowToPlayTransition>
          <HowToPlayFigure
            bottles={[
              [2, 1, 1, 1],
              [3, 3, 1],
            ]}
            selectedBottleIndex={0}
          />
          <HowToPlayFigure
            bottles={[
              [2, 1, 1],
              [3, 3, 1, 1],
            ]}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>注げるのは、注ぎ先が空か、上の色が同じで空きがあるとき。</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {pourConditionFigures.map(({ key, bottles, pourable }) => (
            <div key={key} className="flex items-center gap-2">
              <HowToPlayFigure bottles={bottles} />
              <HowToPlayRuleMark allowed={pourable} />
            </div>
          ))}
        </div>
      </li>
      <li className="space-y-2">
        <p>色ごとに満杯のボトルへそろえば完成。空のボトルは残ってよい。</p>
        <HowToPlayFigure bottles={[[0, 0, 0, 0], [1, 1, 1, 1], []]} />
      </li>
      <li>
        <p>
          待ったで1手ずつ戻せる。注げる手がなくなったら、待ったか盤面を戻すで続ける。
        </p>
      </li>
    </HowToPlayDialog>
  );
}
