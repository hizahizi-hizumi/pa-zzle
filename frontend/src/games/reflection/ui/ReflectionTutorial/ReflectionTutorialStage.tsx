import { useState } from "react";

import type { TutorialBoardIntro } from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import type { ReflectionLaserView } from "@/games/reflection/play/use-reflection-play";
import type {
  ReflectionBoard as ReflectionBoardState,
  ReflectionInventory,
  ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionStock } from "@/games/reflection/ui/ReflectionStock";
import { ReflectionTutorialRewind } from "@/games/reflection/ui/ReflectionTutorial/ReflectionTutorialRewind";

export type ReflectionTutorialView = {
  board: ReflectionBoardState;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  laser: ReflectionLaserView | null;
  cues: readonly ReflectionCue[];
};

type ReflectionTutorialStageProps = {
  intro: TutorialBoardIntro;
  clues: readonly ReflectionClue[];
  inventory: ReflectionInventory;
  /** 解き終えた盤面。導入でゴールとして見せ、始めの盤面へ戻すときにピースを消していく。 */
  goal: ReflectionTutorialView;
  /** 解いている盤面。 */
  current: ReflectionTutorialView;
  /** 解いている盤面の完成演出の進み。 */
  progress: GameProgress;
  interactionDisabled: boolean;
  onSelectCell: (cellIndex: number) => void;
  onSelectStockPiece: (piece: ReflectionPiece) => void;
  onSelectClue: (entry: ReflectionEntry) => void;
  onRemovePiece: (cellIndex: number) => void;
  onClearAnimationComplete: () => void;
};

/**
 * 導入のゴールの場面では、解き終えた盤面に本番と同じ完成演出で全光路を伸ばし、伸ばし終えるか、押して場面の動きを終えたら、全光路を出したまま見せる。
 * 始めの盤面の場面では、何も置いていない盤面にゴールのピースを重ね、1つずつ消して始めの盤面へ戻す。
 */
export function ReflectionTutorialStage({
  intro: { scene, playing, onSceneEnd },
  clues,
  inventory,
  goal,
  current,
  progress,
  interactionDisabled,
  onSelectCell,
  onSelectStockPiece,
  onSelectClue,
  onRemovePiece,
  onClearAnimationComplete,
}: ReflectionTutorialStageProps) {
  const goalShown = scene === "goal";
  // ゴールの全光路を伸ばし始めた。伸ばす前は光路を出さない。
  // 伸ばし始めた後は、伸ばし終えたときも、押して場面の動きを終えたときも、全光路を出したまま見せる。
  const [goalLightShown, setGoalLightShown] = useState(false);
  if (goalShown && playing && !goalLightShown) {
    setGoalLightShown(true);
  }
  const view = goalShown ? goal : current;
  const boardProgress: GameProgress = goalShown
    ? playing
      ? "clearing"
      : goalLightShown
        ? "result"
        : "playing"
    : progress;

  return (
    <div className="flex w-[min(100cqw,calc(100cqh-3.75rem),28rem)] flex-col gap-2">
      <div className="relative aspect-square w-full">
        <ReflectionTutorialRewind
          active={scene === "start" && playing}
          goal={goal.board}
          onComplete={onSceneEnd}
        >
          <ReflectionBoard
            board={view.board}
            clues={clues}
            clueMatches={listReflectionClueMatches(view.board, clues)}
            selection={view.selection}
            laser={view.laser}
            interactionDisabled={interactionDisabled || scene !== null}
            progress={boardProgress}
            cues={view.cues}
            onSelectCell={onSelectCell}
            onSelectClue={onSelectClue}
            onRemovePiece={onRemovePiece}
            onClearAnimationComplete={
              goalShown ? onSceneEnd : onClearAnimationComplete
            }
          />
        </ReflectionTutorialRewind>
      </div>
      <ReflectionStock
        inventory={inventory}
        stock={view.stock}
        selection={view.selection}
        selectedCell={
          view.selection?.type === "cell"
            ? (view.board.cells[view.selection.cellIndex] ?? null)
            : null
        }
        // 導入の間は盤面の領域ごと押せないので、始めの盤面ではピースを押せる姿のまま見せる。
        // 解き終えた後は残りが無く、どの種類も押せない。
        disabled={false}
        cues={view.cues}
        onSelectStockPiece={onSelectStockPiece}
      />
    </div>
  );
}
