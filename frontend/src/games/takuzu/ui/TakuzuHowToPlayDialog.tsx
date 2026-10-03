import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayRuleMark } from "@/components/HowToPlayRuleMark";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";

type TakuzuHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** ルールと操作を、盤面と同じ見え方の小さな図と短い一文で示す。 */
export function TakuzuHowToPlayDialog({
  open,
  onClose,
}: TakuzuHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="すべてのマスを四角か丸で埋める。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>各行・各列の四角と丸は同じ数。</p>
        <HowToPlayFigure rows={["abaabbab"]} />
      </li>
      <li className="space-y-2">
        <p>同じものは3つ以上続けない。</p>
        <div className="flex items-center gap-3">
          <HowToPlayFigure rows={["aab"]} />
          <HowToPlayRuleMark allowed />
          <HowToPlayFigure rows={["aaa"]} violation="run" />
          <HowToPlayRuleMark allowed={false} />
        </div>
      </li>
      <li className="space-y-2">
        <p>同じ並びの行・列は作れない。</p>
        <div className="flex items-center gap-3">
          <HowToPlayFigure rows={["abaabbab", "abaabbab"]} violation="line" />
          <HowToPlayRuleMark allowed={false} />
        </div>
      </li>
      <li className="space-y-2">
        <p>タップで 空き → 四角 → 丸 → 空き。</p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={["."]} />
          <HowToPlayFigure rows={["a"]} />
          <HowToPlayFigure rows={["b"]} />
          <HowToPlayFigure rows={["."]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>最初からあるタイルは変えられない。</p>
        <HowToPlayFigure rows={["AB"]} />
      </li>
    </HowToPlayDialog>
  );
}
