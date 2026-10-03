import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { writeTsumeShogiHowToPlaySeen } from "@/games/tsume-shogi/ui/how-to-play-seen";
import { tsumeShogiPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import {
  PieceMovementFigure,
  pieceMovementFigureTypes,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PieceMovementFigure";

type TsumeShogiHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * ルールと操作を短い文と駒の動きの図で示す。一度閉じたら、初めて遊ぶときの自動表示をしないよう記録する。
 */
export function TsumeShogiHowToPlayDialog({
  open,
  onClose,
}: TsumeShogiHowToPlayDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      writeTsumeShogiHowToPlaySeen();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>遊び方</DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="閉じる"
              >
                <X />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription>
            手前の攻方を指して、玉方の玉を詰ませる。「3手詰」は攻方と玉方の手を合わせた手数で、その手数のうちに詰ませる。
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4 text-supporting">
          <li>
            <p>攻方は毎手、王手をかける。王手にならない手は指せない。</p>
          </li>
          <li>
            <p>
              玉方は自動で指し、いちばん長く逃れる手を選ぶ。盤上と攻方の持駒にない駒はすべて玉方の持駒（残り全部）で、合駒に使える。
            </p>
          </li>
          <li className="space-y-2">
            <p>駒の動き。点は1升、矢印は何升でも進める。</p>
            <ul className="grid grid-cols-5 gap-x-1 gap-y-2">
              {pieceMovementFigureTypes.map((type) => (
                <li key={type} className="flex flex-col items-center gap-0.5">
                  <PieceMovementFigure type={type} />
                  <span className="text-meta text-muted-foreground">
                    {tsumeShogiPieceNames[type]}
                  </span>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <p>
              上の3段（相手の陣地）に入る・そこから出る・その中で動くと成れる。飛は龍、角は馬に、銀・桂・香・歩は金と同じ動きになる。成・不成のどちらも指せるときは、どちらにするかを選ぶ。
            </p>
          </li>
          <li>
            <p>持駒は空いた升に打てる。</p>
          </li>
          <li>
            <p>
              指せない手:
              二歩（歩のある筋に歩を打つ）、打歩詰（歩を打って詰ませる）、行き所のない駒（その先へ動けない段に成らずに置く）。
            </p>
          </li>
          <li>
            <p>
              詰まない王手を指すと、玉方が逃れる手を指す。「戻る」でその王手の前に戻って考え直す。続けて王手してその筋を確かめてもよい。
            </p>
          </li>
          <li>
            <p className="text-muted-foreground">
              駒を押して選び、行き先の升を押す。持駒は押してから打つ升を押す。
            </p>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
