import { useState } from "react";

import {
  type TutorialOrigin,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  getTakuzuSessionCellViews,
  getTakuzuSessionLineViolations,
} from "@/games/takuzu/session/session";
import {
  type TakuzuTutorialAction,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import {
  getCurrentTutorialStep,
  performTutorialAction,
  startTutorial,
} from "@/games/tutorial";

type TakuzuTutorialProps = {
  open: boolean;
  origin: TutorialOrigin;
  onClose: () => void;
};

// 完成の波はチュートリアルでは終わりを待つ先が無い。参照が変わると波をやり直すので、同じ関数を渡し続ける。
function ignoreClearAnimationComplete(): void {}

/** 4×4 の固定盤面で、指示したマスの操作だけを受け付けながらルールと操作を順に体験させる。 */
export function TakuzuTutorial({ open, origin, onClose }: TakuzuTutorialProps) {
  const [progress, setProgress] = useState(() => startTutorial(takuzuTutorial));
  const step = getCurrentTutorialStep(takuzuTutorial, progress);
  const session = progress.state;

  function perform(action: TakuzuTutorialAction): void {
    setProgress((current) =>
      performTutorialAction(takuzuTutorial, current, action),
    );
  }

  function handleCycleCell(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
    perform({ type: "cycle", cellIndex, direction });
  }

  function handlePlaceCell(cellIndex: number, cell: TakuzuCell): void {
    perform({ type: "place", cellIndex, cell });
  }

  function handlePressGivenCell(cellIndex: number): void {
    perform({ type: "cycle", cellIndex, direction: "forward" });
  }

  // 完了したかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    setProgress(startTutorial(takuzuTutorial));
    onClose();
  }

  return (
    <TutorialOverlay
      open={open}
      gameTitle="バイナリパズル"
      stepCount={takuzuTutorial.steps.length}
      achievedStepCount={progress.achievedStepCount}
      instruction={step?.instruction ?? null}
      origin={origin}
      onClose={handleClose}
    >
      <TakuzuClearAnimation
        active={session.status === "cleared"}
        onComplete={ignoreClearAnimationComplete}
      >
        <TakuzuBoard
          size={session.board.size}
          cells={getTakuzuSessionCellViews(session)}
          lineViolations={getTakuzuSessionLineViolations(session)}
          disabled={step === null}
          highlightedCellIndices={step?.highlightedTargets}
          onCycleCell={handleCycleCell}
          onPlaceCell={handlePlaceCell}
          onPressGivenCell={handlePressGivenCell}
        />
      </TakuzuClearAnimation>
    </TutorialOverlay>
  );
}
