import {
  BookOpen,
  Home,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  onReplay: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function GameResultActions({
  onStartNewProblem,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: GameResultActionsProps) {
  return (
    <div className="mt-4 grid gap-3">
      <Button size="lg" onClick={onStartNewProblem}>
        <Play />
        プレイ！
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onReplay}>
          <RotateCcw />
          同じ問題
        </Button>
        <Button variant="outline" onClick={onOpenRecords}>
          <BookOpen />
          記録を確認
        </Button>
        <Button variant="outline" onClick={onChangeDifficulty}>
          <SlidersHorizontal />
          難易度変更
        </Button>
        <Button variant="outline" onClick={onBackToHome}>
          <Home />
          ホーム
        </Button>
      </div>
    </div>
  );
}
