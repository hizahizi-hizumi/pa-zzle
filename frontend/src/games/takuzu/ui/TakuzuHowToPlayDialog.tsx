import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayRuleMark } from "@/components/HowToPlayRuleMark";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";

type TakuzuHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function TakuzuHowToPlayDialog({
  open,
  onClose,
}: TakuzuHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="すべてのマスを0か1で埋める。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>各行・各列の0と1は同じ数。</p>
        <HowToPlayFigure rows={["abaabbab"]} />
      </li>
      <li className="space-y-2">
        <p>同じ数字は3つ以上続けない。</p>
        <div className="flex items-center gap-3">
          <HowToPlayFigure rows={["aab"]} />
          <HowToPlayRuleMark figureAllowed />
          <HowToPlayFigure rows={["aaa"]} violation="run" />
          <HowToPlayRuleMark figureAllowed={false} />
        </div>
      </li>
      <li className="space-y-2">
        <p>同じ並びの行・列は作らない。</p>
        <div className="flex items-center gap-3">
          <HowToPlayFigure rows={["abaabbab", "abaabbab"]} violation="line" />
          <HowToPlayRuleMark figureAllowed={false} />
        </div>
      </li>
      <li className="space-y-2">
        <p>タップで 空き → 0 → 1 → 空き。</p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={["."]} />
          <HowToPlayFigure rows={["a"]} />
          <HowToPlayFigure rows={["b"]} />
          <HowToPlayFigure rows={["."]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>最初からある数字は変えられない。</p>
        <HowToPlayFigure rows={["AB"]} />
      </li>
    </HowToPlayDialog>
  );
}
