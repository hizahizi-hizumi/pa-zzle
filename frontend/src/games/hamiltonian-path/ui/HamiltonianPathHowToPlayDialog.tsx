import { HowToPlayDialog } from "@/components/HowToPlayDialog";

type HamiltonianPathHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** ルールと操作を短い一文ずつで示す。 */
export function HamiltonianPathHowToPlayDialog({
  open,
  onClose,
}: HamiltonianPathHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="丸い印のマスから、すべてのマスを1回ずつ通る1本の道を引く。"
      onClose={onClose}
    >
      <li>道は上下左右に隣り合うマスへ進む。同じマスは2回通れない。</li>
      <li>暗いマスと、マスの間の暗い棒の向こうへは進めない。</li>
      <li>道の先端に隣り合うマスを押すと、道が1マス延びる。</li>
      <li>道の途中のマスを押すと、そのマスまで道が戻る。</li>
    </HowToPlayDialog>
  );
}
