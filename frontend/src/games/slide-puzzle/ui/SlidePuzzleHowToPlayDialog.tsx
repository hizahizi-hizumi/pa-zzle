import { ArrowRight } from "lucide-react";

import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import { HowToPlayFigure } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/HowToPlayFigure";

type SlidePuzzleHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const solvedBoard: SlidePuzzleBoard = [1, 2, 3, 4, 5, 6, 7, 8, 0];

const singleSlide = {
  before: [1, 2, 3, 4, 0, 6, 7, 5, 8],
  pressedTile: 5,
  after: [1, 2, 3, 4, 5, 6, 7, 0, 8],
} as const;

const multipleSlide = {
  before: [1, 2, 3, 4, 5, 6, 0, 7, 8],
  pressedTile: 8,
  after: solvedBoard,
} as const;

/** ルールと操作を、盤面と同じタイルの小さな図と短い一文で示す。 */
export function SlidePuzzleHowToPlayDialog({
  open,
  onClose,
}: SlidePuzzleHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="タイルを空白へ滑らせて、番号順に並べる。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>左上から 1 から順に並び、右下が空白になれば完成。</p>
        <HowToPlayFigure board={solvedBoard} />
      </li>
      <li className="space-y-2">
        <p>空白の隣のタイルを押すと、空白へ滑る。</p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure
            board={singleSlide.before}
            pressedTile={singleSlide.pressedTile}
          />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure board={singleSlide.after} />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          空白と同じ行・列のタイルを押すと、間のタイルごとまとめて滑る。手数は動いたタイルの枚数で数える。
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure
            board={multipleSlide.before}
            pressedTile={multipleSlide.pressedTile}
          />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure board={multipleSlide.after} />
        </div>
      </li>
      <li>
        <p>空白と同じ行・列にないタイルは動かない。</p>
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード: 矢印キーで、空白の隣のタイルを矢印の向きへ滑らせる。
        </p>
      </li>
    </HowToPlayDialog>
  );
}
