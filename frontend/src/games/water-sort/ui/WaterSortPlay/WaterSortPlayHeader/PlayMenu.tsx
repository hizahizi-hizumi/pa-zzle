import {
  Home,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MenuButton } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayMenu/MenuButton";

type PlayMenuProps = {
  onRestart: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayMenu({
  onRestart,
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
            label="最初から"
            onClick={() => runAndClose(onRestart)}
          />
          <MenuButton
            icon={<RefreshCw />}
            label="新しい問題"
            onClick={() => runAndClose(onStartNewProblem)}
          />
          <MenuButton
            label="難易度を変える"
            onClick={() => runAndClose(onChangeDifficulty)}
          />
          <MenuButton
            icon={<Home />}
            label="ホームへ"
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
