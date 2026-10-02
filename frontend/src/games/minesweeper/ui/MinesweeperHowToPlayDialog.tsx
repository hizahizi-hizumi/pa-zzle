import { ArrowRight, Flag, Pointer } from "lucide-react";

import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayFigure } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayFigure";

type MinesweeperHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** ルールと操作を、盤面と同じ見え方の小さな図と短い一文で示す。 */
export function MinesweeperHowToPlayDialog({
  open,
  onClose,
}: MinesweeperHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="数字を手がかりに、地雷ではないマスをすべて開く。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          数字は、周りの8マスにある地雷の数。盤面全体の地雷の数は、上の「地雷」に出る。
        </p>
        <HowToPlayFigure rows={["*..", ".2.", "..*"]} />
      </li>
      <li className="space-y-2">
        <p>周りに地雷がないマスを開くと、周りも続けて開く。</p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure rows={["....", "....", "...."]} pressed={[2, 0]} />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure rows={["001.", "0011", "0000"]} />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          押して開く。上のボタンで開く
          <Pointer
            className="mx-0.5 inline size-4 align-text-bottom"
            aria-hidden
          />
          と旗
          <Flag
            className="mx-0.5 inline size-4 align-text-bottom"
            aria-hidden
          />
          を切り替えると、押して旗を置く・外す。長押しと右クリックは、いつでも旗を置く・外す。
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure rows={["."]} />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure rows={["F"]} />
        </div>
      </li>
      <li>
        <p>
          旗は自分用の印で、正しいかは判定しない。旗を置いたマスは開かない。
        </p>
      </li>
      <li className="space-y-2">
        <p>
          開くモードで開いた数字を押すと、周りの旗と踏んだ地雷が数字と同じ数のとき、残りのマスをまとめて開く。旗が間違っていると地雷を踏む。
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HowToPlayFigure rows={["F..", ".1.", "..."]} pressed={[1, 1]} />
          <ArrowRight className="size-4" aria-hidden />
          <HowToPlayFigure rows={["F10", "110", "000"]} />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          地雷を踏んでも続けられる。踏んだ地雷は盤面に残り、ミスとして数える。
        </p>
        <HowToPlayFigure rows={["1x1", "111"]} />
      </li>
    </HowToPlayDialog>
  );
}
