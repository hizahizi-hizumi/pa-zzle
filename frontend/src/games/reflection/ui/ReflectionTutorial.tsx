import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import type { ReflectionLaserView } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { getReflectionSessionStock } from "@/games/reflection/session/session";
import {
  findReflectionTutorialHint,
  getReflectionTutorialLaserEntry,
  getReflectionTutorialStepTarget,
  type ReflectionTutorialAction,
  type ReflectionTutorialBoardState,
  type ReflectionTutorialRuleId,
  reflectionTutorial,
} from "@/games/reflection/tutorial/tutorial";
import type {
  ReflectionCue,
  ReflectionCueTarget,
} from "@/games/reflection/ui/board/cue";
import {
  ReflectionTutorialStage,
  type ReflectionTutorialView,
} from "@/games/reflection/ui/ReflectionTutorial/ReflectionTutorialStage";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type ReflectionTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type ReflectionTutorialProgress = TutorialProgress<
  ReflectionTutorialRuleId,
  ReflectionTutorialBoardState
>;

/**
 * 手を離した後、手が止まってから次の手を示すまでの間。
 * 外周の数字を読み比べて考えている間は先回りしないよう、長めに待つ。
 */
const IDLE_HINT_DELAY_MS = 10_000;

const goalBoardState = reflectionTutorial.goal();
const { problem } = goalBoardState.session;

const goalView: ReflectionTutorialView = {
  board: goalBoardState.session.puzzleState,
  stock: getReflectionSessionStock(goalBoardState.session),
  selection: null,
  laser: null,
  cues: [],
};

function createLaserView(
  state: ReflectionTutorialBoardState,
  entry: ReflectionEntry | null,
): ReflectionLaserView | null {
  return entry === null
    ? null
    : { entry, trace: traceReflectionLaser(state.session.puzzleState, entry) };
}

function getBoardProgress(progress: ReflectionTutorialProgress): GameProgress {
  switch (progress.phase) {
    case "solved":
      return "clearing";
    case "completed":
      return "result";
    default:
      return "playing";
  }
}

/**
 * 5×5 の盤面を、一言と印に沿って一緒に解き、数字の意味と4種類のピースの働きを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りのピースを自分で置かせる。盤面・ストック・完成演出は本番と同じ部品を使う。
 */
export function ReflectionTutorial({
  open,
  onStartPlay,
  onClose,
}: ReflectionTutorialProps) {
  const [progress, setProgress] = useState<ReflectionTutorialProgress>(() =>
    startTutorial(reflectionTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<ReflectionTutorialProgress | null>(null);
  // 手を引いている間に印の無い所を押したら、押した所を縁取り、印を光らせて付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const [rejectedTarget, setRejectedTarget] =
    useState<ReflectionCueTarget | null>(null);
  const situation = getTutorialSituation(reflectionTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const idleHintPending = playing && !guiding;
  const idleHint =
    idleHintPending && idleProgress === progress
      ? findReflectionTutorialHint(boardState)
      : null;
  const message = getTutorialMessage(reflectionTutorial, progress, {
    entry: onStartPlay ? "selection" : "play",
    violationSettled: true,
  });

  useEffect(() => {
    if (!open || !idleHintPending) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, idleHintPending]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(
    action: ReflectionTutorialAction,
    target: ReflectionCueTarget | null,
  ): void {
    const next = performTutorialAction(reflectionTutorial, progress, action);
    if (next === progress) {
      if (guiding && playing && target !== null) {
        setRejectedTarget(target);
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setRejectedTarget(null);
    setProgress(next);
  }

  function handleSelectCell(cellIndex: number): void {
    perform({ type: "cell", cellIndex }, { type: "cell", cellIndex });
  }

  function handleSelectStockPiece(piece: ReflectionPiece): void {
    perform({ type: "stock", piece }, { type: "stock", piece });
  }

  function handleSelectClue(entry: ReflectionEntry): void {
    perform({ type: "clue", entry }, { type: "clue", entry });
  }

  function handleRemovePiece(cellIndex: number): void {
    perform({ type: "remove", cellIndex }, null);
  }

  function restart(): void {
    setIdleProgress(null);
    setRejectedTarget(null);
    setProgress(startTutorial(reflectionTutorial));
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
   * 手順の印・決め手・直前の手への合図。最初の手順の印は、導入の終わりに一言と同時に出す。
   * 手を離した後は、手が止まったときだけ次の手と決め手を示す。
   */
  function getCues(marksShown: boolean): ReflectionCue[] {
    const { lastMove, moveCount } = boardState;
    const cues: ReflectionCue[] = [];
    if (lastMove?.fittedCellIndex != null) {
      cues.push({
        target: { type: "cell", cellIndex: lastMove.fittedCellIndex },
        kind: "fitted",
        id: moveCount,
      });
    }
    if (marksShown && step !== null) {
      if (step.type === "place") {
        for (const entry of step.reasonEntries) {
          cues.push({ target: { type: "clue", entry }, kind: "reason", id: 0 });
        }
      }
      const target = getReflectionTutorialStepTarget(situation, boardState);
      if (target !== null) {
        cues.push({ target, kind: "hint", id: hintCueId });
      }
    }
    if (idleHint !== null) {
      for (const entry of idleHint.reasonEntries) {
        cues.push({ target: { type: "clue", entry }, kind: "reason", id: 0 });
      }
      cues.push({ target: idleHint.target, kind: "hint", id: hintCueId });
    }
    if (rejectedTarget !== null) {
      cues.push({ target: rejectedTarget, kind: "rejected", id: hintCueId });
    }
    return cues;
  }

  function renderBoard(intro: TutorialBoardIntro) {
    // 最初の手順の印と光は、導入の終わりに一言と同時に出す。
    const marksShown = playing || (intro.scene === null && intro.messageShown);
    const { session } = boardState;
    const current: ReflectionTutorialView = {
      board: session.puzzleState,
      stock: getReflectionSessionStock(session),
      selection: session.selection,
      laser: marksShown
        ? createLaserView(
            boardState,
            getReflectionTutorialLaserEntry(situation, boardState),
          )
        : null,
      cues: getCues(marksShown),
    };
    return (
      <ReflectionTutorialStage
        intro={intro}
        clues={problem.clues}
        inventory={problem.inventory}
        goal={goalView}
        current={current}
        progress={getBoardProgress(progress)}
        interactionDisabled={!playing}
        onSelectCell={handleSelectCell}
        onSelectStockPiece={handleSelectStockPiece}
        onSelectClue={handleSelectClue}
        onRemovePiece={handleRemovePiece}
        onClearAnimationComplete={handleClearAnimationComplete}
      />
    );
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={REFLECTION_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={reflectionTutorial.intro}
      rules={reflectionTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: step?.introducedRuleId === rule.id,
      }))}
      message={message}
      introducing={progress.phase === "intro"}
      completed={progress.phase === "completed"}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
