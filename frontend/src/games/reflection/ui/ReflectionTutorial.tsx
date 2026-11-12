import { useCallback, useEffect, useEffectEvent, useState } from "react";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
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
  describeReflectionTutorialMessage,
  findReflectionTutorialHint,
  getReflectionTutorialHintSpotlight,
  getReflectionTutorialLaserEntry,
  getReflectionTutorialProgressRatio,
  getReflectionTutorialStepSpotlight,
  listReflectionTutorialStepMarks,
  REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT,
  type ReflectionTutorialAction,
  type ReflectionTutorialBoardState,
  type ReflectionTutorialMark,
  type ReflectionTutorialRuleId,
  type ReflectionTutorialSpotlight,
  reflectionTutorial,
} from "@/games/reflection/tutorial/tutorial";
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { ReflectionGround } from "@/games/reflection/ui/ReflectionGround";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { listReflectionStockPieces } from "@/games/reflection/ui/ReflectionStock";
import {
  ReflectionTutorialStage,
  type ReflectionTutorialView,
} from "@/games/reflection/ui/ReflectionTutorial/ReflectionTutorialStage";
import { useReflectionSoundEffects } from "@/games/reflection/ui/use-reflection-sound-effects";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialProgress,
} from "@/games/tutorial";

type ReflectionTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。渡さなければプレイ中に開いたとして扱う。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type ReflectionTutorialProgress = TutorialProgress<
  ReflectionTutorialRuleId,
  ReflectionTutorialBoardState
>;

/** 置いた音の知らせの番号を、回ごとに重ならないようにずらす幅。1回の手の数はこれより十分少ない。 */
const RUN_OPERATION_ID_STRIDE = 100_000;

/**
 * 手順どおりに置いてから、次の手順の一言と印に替えるまでの間。
 * 置いた結果の光と緑になった数字を、置いた手順の一言のまま見て取れるだけ残す。
 */
const NEXT_STEP_DELAY_MS = 1400;

/**
 * 手を引いている間に印の無い所を押されたときの、印の押し直し。印の線を短く濃くして戻す。
 * - `id`: 押されるたびに増やし、続けて押されても押し直す。
 * - `progress`: 押されたときの進行。手が進んだら押し直しを終える。
 */
type ReflectionTutorialRecall = {
  id: number;
  progress: ReflectionTutorialProgress;
};

const goalBoardState = reflectionTutorial.goal();
const { problem } = goalBoardState.session;

const goalView: ReflectionTutorialView = {
  board: goalBoardState.session.puzzleState,
  stock: getReflectionSessionStock(goalBoardState.session),
  selection: null,
  laser: null,
  cues: [],
};

const noSpotlight: ReflectionTutorialSpotlight = {
  entries: [],
  cellIndices: [],
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

function hasSpotlight({
  entries,
  cellIndices,
}: ReflectionTutorialSpotlight): boolean {
  return entries.length > 0 || cellIndices.length > 0;
}

export function ReflectionTutorial({
  open,
  playStart,
  onClose,
}: ReflectionTutorialProps) {
  const [progress, setProgress] = useState<ReflectionTutorialProgress>(() =>
    startTutorial(reflectionTutorial),
  );
  const [recall, setRecall] = useState<ReflectionTutorialRecall | null>(null);
  // 「ヒント」を押したときの進行。次の手で手がかりを消し、1回で答えまで見せないようにする。
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<ReflectionTutorialProgress | null>(null);
  // 手順を終えた手の進行と、その手の前の進行。置いた結果を見せる間は、一言を終えた手順のままにする。
  const [finishedStep, setFinishedStep] = useState<{
    progress: ReflectionTutorialProgress;
    previous: ReflectionTutorialProgress;
  } | null>(null);
  const [lingerEndedProgress, setLingerEndedProgress] =
    useState<ReflectionTutorialProgress | null>(null);
  // 開き直したり、もう一度始めたりするたびに増やし、前の回と同じ手の数でも置いた音を鳴らす。
  const [runCount, setRunCount] = useState(0);
  const situation = getTutorialSituation(reflectionTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const recallId = recall?.progress === progress ? recall.id : null;
  const lingering =
    playing &&
    finishedStep?.progress === progress &&
    lingerEndedProgress !== progress;
  const hintRequestable = playing && !guiding && !lingering;
  const hint =
    hintRequestable && hintRequestedProgress === progress
      ? findReflectionTutorialHint(boardState)
      : null;
  const boardProgress = getBoardProgress(progress);
  useReflectionSoundEffects(
    boardState.lastMove?.piecePlaced
      ? {
          id: runCount * RUN_OPERATION_ID_STRIDE + boardState.moveCount,
          type: "piece-placed",
        }
      : null,
    boardProgress,
  );

  useEffect(() => {
    if (!open || !lingering) {
      return;
    }
    const timer = window.setTimeout(
      () => setLingerEndedProgress(progress),
      NEXT_STEP_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, lingering]);

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
        setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
      }
      return;
    }
    if (next.stepIndex !== progress.stepIndex) {
      setFinishedStep({ progress: next, previous: progress });
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
    setRecall(null);
    setHintRequestedProgress(null);
    setFinishedStep(null);
    setLingerEndedProgress(null);
    setRunCount((count) => count + 1);
    setProgress(startTutorial(reflectionTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    setProgress(finishTutorialIntro);
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  /** 見せる物が無ければ空で、覆わない。 */
  function getSpotlight(): ReflectionTutorialSpotlight {
    if (!playing || lingering) {
      return noSpotlight;
    }
    if (guiding) {
      return getReflectionTutorialStepSpotlight(situation, boardState);
    }
    return hint === null
      ? noSpotlight
      : getReflectionTutorialHintSpotlight(hint, boardState);
  }

  const spotlight = getSpotlight();

  function getMarks(): ReflectionTutorialMark[] {
    if (!playing || lingering) {
      return [];
    }
    if (guiding) {
      return listReflectionTutorialStepMarks(situation, boardState);
    }
    return hint === null ? [] : [{ target: hint.target, pointed: false }];
  }

  function getCues(): ReflectionCue[] {
    const { lastMove, moveCount } = boardState;
    const cues: ReflectionCue[] = [];
    if (lastMove?.fittedCellIndex != null && playing) {
      cues.push({
        target: { type: "cell", cellIndex: lastMove.fittedCellIndex },
        kind: "acknowledgement",
        id: moveCount,
      });
    }
    for (const { target, pointed } of getMarks()) {
      cues.push({ target, kind: "mark", recallId, pointed });
    }
    for (const entry of spotlight.entries) {
      cues.push({ target: { type: "clue", entry }, kind: "spotlight" });
    }
    for (const cellIndex of spotlight.cellIndices) {
      cues.push({ target: { type: "cell", cellIndex }, kind: "spotlight" });
    }
    return cues;
  }

  function renderBoard(intro: TutorialStageBoardIntro) {
    // 手順の印と光は、始めの盤面に替え終えてから出す。
    const marksShown = intro.scene === null;
    const { session } = boardState;
    const solvingView: ReflectionTutorialView = {
      board: session.puzzleState,
      stock: getReflectionSessionStock(session),
      selection: session.selection,
      laser: marksShown
        ? createLaserView(
            boardState,
            // 手がかりは、手を引く間と同じく、決め手の今の光と一緒に見せる。
            hint?.reasonEntries[0] ??
              getReflectionTutorialLaserEntry(situation, boardState, lingering),
          )
        : null,
      cues: marksShown ? getCues() : [],
    };
    return (
      <ReflectionTutorialStage
        intro={intro}
        clues={problem.clues}
        inventory={problem.inventory}
        goal={goalView}
        solvingView={solvingView}
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

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 置いた結果を見せる間は、終えた手順の一言のままにする。
   * ただし操作を教える手順の結果は、次の手順で伝える数字の例になるので、その間から次の手順の一言を出す。
   */
  function getPlayingMessage(): TutorialMessage {
    if (hint !== null) {
      return hint.message;
    }
    const finished = lingering
      ? getTutorialSituation(
          reflectionTutorial,
          finishedStep?.previous ?? progress,
        ).step
      : null;
    if (finished && finished.choice !== "none") {
      return finished.message;
    }
    return describeReflectionTutorialMessage(situation, boardState);
  }

  const message = playing
    ? getPlayingMessage()
    : getTutorialMessage(reflectionTutorial, progress, {
        entry: finish.entry,
        violationSettled: true,
      });

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={REFLECTION_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<ReflectionGround />}
      intro={reflectionTutorial.intro}
      recap={reflectionTutorial.rules.map((rule) => rule.label)}
      message={message}
      phase={progress.phase}
      spotlighting={hasSpotlight(spotlight)}
      progress={
        playing || progress.phase === "intro"
          ? getReflectionTutorialProgressRatio(boardState)
          : 1
      }
      progressStepCount={REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <ReflectionHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && hint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
