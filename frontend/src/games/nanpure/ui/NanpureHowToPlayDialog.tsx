import { ArrowRight } from "lucide-react";

import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import {
  HowToPlayFigure,
  type HowToPlayFigureCell,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/HowToPlayFigure";

type NanpureHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const completedBlock: readonly (readonly HowToPlayFigureCell[])[] = [
  [{ digit: 5, given: true }, { digit: 3, given: true }, { digit: 4 }],
  [{ digit: 6 }, { digit: 7, given: true }, { digit: 2 }],
  [{ digit: 1, given: true }, { digit: 9 }, { digit: 8, given: true }],
];

const clueAndEntered = [
  { caption: "最初から", cell: { digit: 6, given: true } },
  { caption: "入れた", cell: { digit: 6 } },
] as const;

/** ルールと操作を、盤面と同じ見え方の小さな図と短い一文で示す。 */
export function NanpureHowToPlayDialog({
  open,
  onClose,
}: NanpureHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="空いたマスに1〜9の数字を入れて、盤面を完成させる。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>各行・各列・各3×3ブロックに、1〜9を1つずつ。</p>
        <HowToPlayFigure rows={completedBlock} />
      </li>
      <li className="space-y-2">
        <p>最初からある数字は変えられない。</p>
        <div className="flex items-center gap-4">
          {clueAndEntered.map(({ caption, cell }) => (
            <figure key={caption} className="flex items-center gap-2">
              <HowToPlayFigure rows={[[cell]]} />
              <figcaption className="text-meta text-muted-foreground">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </li>
      <li className="space-y-2">
        <p>マスを選び、下の数字を押して入れる。</p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure rows={[[{ highlight: "selected" }]]} />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure rows={[[{ highlight: "selected", digit: 7 }]]} />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          メモをオンにすると、数字を候補として小さく書く。もう一度押すと消える。
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure rows={[[{ highlight: "selected" }]]} />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure
            rows={[[{ highlight: "selected", notes: [1, 3, 8] }]]}
          />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          正しい数字を入れると、同じ行・列・ブロックのメモからその数字が消える。
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure
            rows={[
              [{ notes: [2, 5] }, { notes: [5, 8] }, { highlight: "selected" }],
            ]}
          />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure
            rows={[
              [
                { notes: [2] },
                { notes: [8] },
                { highlight: "selected", digit: 5 },
              ],
            ]}
          />
        </div>
      </li>
      <li className="space-y-2">
        <p>答えと違う数字は赤くなり、ミスに数える。</p>
        <HowToPlayFigure rows={[[{ digit: 4, error: "mistake" }]]} />
      </li>
      <li className="space-y-2">
        <p>同じ行・列・ブロックで重なった数字は、どちらも濃い赤になる。</p>
        <HowToPlayFigure
          rows={[
            [
              { digit: 3, given: true, error: "conflict" },
              {},
              { digit: 3, error: "conflict" },
            ],
          ]}
        />
      </li>
      <li>
        <p>「消す」で選んだマスの数字とメモを消す。「待った」で1手戻す。</p>
      </li>
      <li>
        <p>9つとも正しく入れた数字は、下の数字が押せなくなる。</p>
      </li>
    </HowToPlayDialog>
  );
}
