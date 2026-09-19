import {
  Home,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MenuButton } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayMenu/MenuButton";

type PlayMenuProps = {
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayMenu({
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: PlayMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  function runAndClose(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="その他の操作"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal />
      </Button>
      {isOpen && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-10 grid w-44 gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <MenuButton
            icon={<RotateCcw />}
            label="盤面を戻す"
            onClick={() => runAndClose(onRestart)}
          />
          <MenuButton
            icon={<RefreshCw />}
            label="リセット"
            onClick={() => runAndClose(onReplay)}
          />
          <MenuButton
            icon={<Play />}
            label="別の問題"
            onClick={() => runAndClose(onStartNewProblem)}
          />
          <MenuButton
            icon={<SlidersHorizontal />}
            label="難易度変更"
            onClick={() => runAndClose(onChangeDifficulty)}
          />
          <MenuButton
            icon={<Home />}
            label="ホーム"
            onClick={() => runAndClose(onBackToHome)}
          />
          {onOpenDiagnostics && (
            <>
              <div className="my-1 border-t" />
              <MenuButton
                icon={<Wrench />}
                label="検証情報"
                onClick={() => runAndClose(onOpenDiagnostics)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
