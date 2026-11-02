import { HowToPlayDialog } from "@/components/HowToPlayDialog";

type BridgesHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** ルールと操作を短い一文ずつで示す。 */
export function BridgesHowToPlayDialog({
  open,
  onClose,
}: BridgesHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="島と島の間に橋を架け、どの島も数字と同じ本数の橋が出ていて、全部の島が1つにつながるようにする。"
      onClose={onClose}
    >
      <li>
        橋は縦か横にまっすぐ、間に島の無い2つの島の間に架ける。同じ2島の間は2本まで。
      </li>
      <li>橋どうしは交差しない。交わる所には架けられない。</li>
      <li>
        島と島の間を押すたびに、橋が1本 → 2本 →
        なしと変わる。島から隣の島へなぞっても同じに変わる。
      </li>
      <li>橋の本数が数字と同じになった島は灰色に、多すぎる島は赤くなる。</li>
    </HowToPlayDialog>
  );
}
