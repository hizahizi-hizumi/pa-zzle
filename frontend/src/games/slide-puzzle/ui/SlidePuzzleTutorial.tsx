import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type TutorialBoardIntro,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getSlidePuzzleSlide } from "@/games/slide-puzzle/puzzle/rules";
import {
  findSlidePuzzleBlankIndex,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
} from "@/games/slide-puzzle/puzzle/state";
import {
  findSlidePuzzleTutorialHintCellIndex,
  getSlidePuzzleTutorialStepCellIndex,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  slidePuzzleTutorial,
  slidePuzzleTutorialScrambleBoards,
} from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import { SlidePuzzleTutorialScramble } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial/SlidePuzzleTutorialScramble";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type SlidePuzzleTutorialProps = {
  open: boolean;
  /** 渡すと、終えたときにレベル1を始める操作を出す。渡さなければ、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type SlidePuzzleTutorialProgress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

/** 手順どおりに滑らせてから次の印を付けるまでの間。タイルが滑り終えるのを見届けてから示す。 */
const NEXT_STEP_CUE_DELAY_MS = 400;

/** 手を離した後、手が止まってから次に滑らせるタイルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = slidePuzzleTutorial.goal();

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、滑らせた直後だけ待ってから付ける。手を離した後は手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: SlidePuzzleTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  return progress.boardState.lastMove?.type === "slid"
    ? NEXT_STEP_CUE_DELAY_MS
    : 0;
}

/** 盤面の滑りと揺れに渡す、直前の手。盤面は手が替わったときだけ動くので、同じ手には同じ値を返す。 */
function toBoardOperation(
  state: SlidePuzzleTutorialBoardState,
): SlidePuzzleOperation | null {
  const { lastMove, moveCount, board } = state;
  if (!lastMove) {
    return null;
  }
  return lastMove.type === "rejected"
    ? { id: moveCount, type: "invalid", tileIndex: lastMove.cellIndex }
    : {
        id: moveCount,
        type: "slid",
        slide: lastMove.slide,
        boardBefore: lastMove.boardBefore,
        boardAfter: board,
        isClearingMove: false,
      };
}

/** 導入で崩していく盤面の、1つ前からの1手。 */
function toScrambleOperation(frameIndex: number): SlidePuzzleOperation | null {
  const boardBefore = slidePuzzleTutorialScrambleBoards[frameIndex - 1];
  const boardAfter = slidePuzzleTutorialScrambleBoards[frameIndex];
  if (!boardBefore || !boardAfter) {
    return null;
  }
  const slide = getSlidePuzzleSlide(
    boardBefore,
    findSlidePuzzleBlankIndex(boardAfter),
  );
  return slide
    ? {
        id: -frameIndex,
        type: "slid",
        slide,
        boardBefore,
        boardAfter,
        isClearingMove: false,
      }
    : null;
}

/**
 * 3×3 の盤面を、一言と印に沿って1手ずつ一緒に並べ、タイルの動き方を1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で並べさせる。盤面・滑り・揺れ・解けたときの波は本番と同じ部品を使う。
 */
export function SlidePuzzleTutorial({
  open,
  onStartPlay,
  onClose,
}: SlidePuzzleTutorialProps) {
  const [progress, setProgress] = useState<SlidePuzzleTutorialProgress>(() =>
    startTutorial(slidePuzzleTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  // 手を引いている間に印の無いタイルを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 || (cueDelayMs !== null && idleProgress === progress);
  const hintCellIndex = !cueShown
    ? null
    : guiding
      ? getSlidePuzzleTutorialStepCellIndex(situation)
      : findSlidePuzzleTutorialHintCellIndex(situation, boardState);
  const boardOperation = useMemo(
    () => toBoardOperation(boardState),
    [boardState],
  );

  useEffect(() => {
    if (!open || cueDelayMs === null || cueDelayMs === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      cueDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, cueDelayMs]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function handleSlideTile(cellIndex: number): void {
    const next = performTutorialAction(slidePuzzleTutorial, progress, {
      type: "tap",
      cellIndex,
    });
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setProgress(next);
  }

  function restart(): void {
    setIdleProgress(null);
    setProgress(startTutorial(slidePuzzleTutorial));
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    onStartPlay?.();
  }

  /**
   * 導入では、空の盤面にタイルを番号順に降ろして完成した盤面を作り、1手ずつ崩して始めの盤面へ戻す。
   * もう一度始めたときは完成した盤面がもう見えているので、崩すところから見せる。
   */
  function renderBoard({ stage, onGoalShown, onEnd }: TutorialBoardIntro) {
    const introducing = progress.phase === "intro";
    return (
      <div className="aspect-square w-[min(100cqw,100cqh,28rem)]">
        <SlidePuzzleTutorialScramble
          active={stage === "start"}
          boards={slidePuzzleTutorialScrambleBoards}
          onComplete={onEnd}
        >
          {(frameIndex) => {
            const shownBoard: SlidePuzzleBoardState =
              frameIndex !== null
                ? (slidePuzzleTutorialScrambleBoards[frameIndex] ??
                  boardState.board)
                : introducing
                  ? goalBoardState.board
                  : boardState.board;
            return (
              <SlidePuzzleBoard
                board={shownBoard}
                operation={
                  frameIndex !== null
                    ? toScrambleOperation(frameIndex)
                    : introducing
                      ? null
                      : boardOperation
                }
                interactionDisabled={progress.phase !== "playing"}
                clearing={progress.phase === "solved"}
                tileEntrance={
                  stage === "goal"
                    ? "settling"
                    : introducing && stage === null
                      ? "concealed"
                      : null
                }
                onTileEntranceComplete={onGoalShown}
                hint={
                  hintCellIndex === null
                    ? null
                    : { cellIndex: hintCellIndex, id: hintCueId }
                }
                onSlideTile={handleSlideTile}
                onClearAnimationComplete={handleClearAnimationComplete}
              />
            );
          }}
        </SlidePuzzleTutorialScramble>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={SLIDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={slidePuzzleTutorial.intro}
      rules={slidePuzzleTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(slidePuzzleTutorial, progress, true)}
      introducing={progress.phase === "intro"}
      completed={progress.phase === "completed"}
      finishAction={
        onStartPlay
          ? { label: "レベル1を遊ぶ", onSelect: handleStartPlay }
          : { label: "プレイに戻る", onSelect: handleClose }
      }
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
