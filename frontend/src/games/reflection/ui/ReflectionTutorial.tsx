import { useCallback, useEffect, useEffectEvent, useState } from "react";

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
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { listReflectionStockPieces } from "@/games/reflection/ui/ReflectionPlay/ReflectionStock";
import { useReflectionSoundEffects } from "@/games/reflection/ui/ReflectionPlay/use-reflection-sound-effects";
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

/** 置いた音の知らせの番号を、回ごとに重ならないようにずらす幅。1回の手の数はこれより十分少ない。 */
const RUN_OPERATION_ID_STRIDE = 100_000;

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
  // 手を引いている間に印の無い所を押したら、印を光らせて付け直し、印へ目を向けさせる。
  // 押した所に赤を出すと、ルールに当たった手だと覚え違えるので出さない。
  const [hintCueId, setHintCueId] = useState(0);
  // 開き直したり、もう一度始めたりするたびに増やし、前の回と同じ手の数でも置いた音を鳴らす。
  const [runCount, setRunCount] = useState(0);
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
  const boardProgress = getBoardProgress(progress);
  // 本番のプレイ画面と同じ効果音を、置いた手と完成演出の始まりに鳴らす。
  useReflectionSoundEffects(
    boardState.lastMove?.piecePlaced
      ? {
          id: runCount * RUN_OPERATION_ID_STRIDE + boardState.moveCount,
          type: "piece-placed",
        }
      : null,
    boardProgress,
  );
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

  // 本番と同じく、数字キーでストックの種類を押し、Esc で選んでいるものを解除する。
  // Esc はチュートリアルを閉じる操作でもあるので、何か選んでいる間だけ選択の解除に使い、閉じる操作より先に受ける。
  const selecting = boardState.session.selection !== null;
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (event.key === "Escape") {
      if (selecting) {
        event.stopPropagation();
        event.preventDefault();
        perform({ type: "clear-selection" });
      }
      return;
    }
    const piece = /^[1-9]$/.test(event.key)
      ? listReflectionStockPieces(problem.inventory)[Number(event.key) - 1]
      : undefined;
    if (piece) {
      event.preventDefault();
      perform({ type: "stock", piece });
    }
  });

  useEffect(() => {
    if (!open || !playing) {
      return;
    }
    // 閉じる操作は document で受けられるので、それより先に window で受ける。
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [open, playing]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(action: ReflectionTutorialAction): void {
    const next = performTutorialAction(reflectionTutorial, progress, action);
    if (next === progress) {
      if (guiding && playing) {
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setProgress(next);
  }

  function handleSelectCell(cellIndex: number): void {
    perform({ type: "cell", cellIndex });
  }

  function handleSelectStockPiece(piece: ReflectionPiece): void {
    perform({ type: "stock", piece });
  }

  function handleSelectClue(entry: ReflectionEntry): void {
    perform({ type: "clue", entry });
  }

  function handleRemovePiece(cellIndex: number): void {
    perform({ type: "remove", cellIndex });
  }

  function restart(): void {
    setIdleProgress(null);
    setRunCount((count) => count + 1);
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
        progress={boardProgress}
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
