import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import { TutorialCue } from "@/components/TutorialCue";
import type {
  TutorialFinish,
  TutorialPlayStart,
} from "@/components/TutorialOverlay";
import {
  TutorialStage,
  type TutorialStageBoardIntro,
} from "@/components/TutorialStage";
import { UndoButton } from "@/components/UndoButton";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import {
  describeTsumeShogiOperation,
  type TsumeShogiOperation,
} from "@/games/tsume-shogi/play/tsume-shogi-operation";
import {
  listTsumeShogiBoardPieceIds,
  listTsumeShogiShownMoves,
  TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  findTsumeShogiDefenderKing,
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
} from "@/games/tsume-shogi/puzzle/position";
import {
  getTsumeShogiSessionPhase,
  type TsumeShogiSessionTurn,
} from "@/games/tsume-shogi/session/session";
import {
  canUndoTsumeShogiTutorial,
  describeTsumeShogiTutorialFreePlay,
  describeTsumeShogiTutorialStep,
  findTsumeShogiTutorialHint,
  getTsumeShogiTutorialProgressRatio,
  getTsumeShogiTutorialStepCue,
  TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT,
  type TsumeShogiTutorialAction,
  type TsumeShogiTutorialBoardState,
  type TsumeShogiTutorialCue,
  type TsumeShogiTutorialRuleId,
  tsumeShogiTutorial,
} from "@/games/tsume-shogi/tutorial/tutorial";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { TsumeShogiBackground } from "@/games/tsume-shogi/ui/TsumeShogiBackground";
import {
  TsumeShogiBoardGroup,
  tsumeShogiBoardGroupSizeStyle,
} from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiHand";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlayStatus";
import { useTsumeShogiSoundEffects } from "@/games/tsume-shogi/ui/use-tsume-shogi-sound-effects";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type TsumeShogiTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type TsumeShogiTutorialProgress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

/**
 * 盤の左右の余白は `TutorialStage` の盤面の欄が取っているので重ねない。
 * 指は升・持駒・待ったのすぐ下に出て、盤・駒台・直前の手の行の中に収まるので、指のための余白は取らない。
 */
const tutorialBoardGroupSizeStyle = {
  ...tsumeShogiBoardGroupSizeStyle,
  "--board-gutter": "0px",
} as CSSProperties;

/** 玉方が応じて次の手順へ進んでから、次の所を指すまでの間。玉が動き終えるのを見届けてから指す。 */
const NEXT_STEP_CUE_DELAY_MS = 450;

/** 手を離した後、手が止まってから次の手を指すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 盤の右上で玉を囲う7手詰を、プレイ画面と同じ地の上で、一言と指さしに沿って2手指し、
 * 動かして王手することと持駒を打つことを身につけさせる。手順を終えたら手を離し、残りの2手を自分で読んで詰ませる。
 * 入口では、詰み上がりが解き方そのものになるので、詰み上がりではなく始めの盤面を見せる。
 * 盤・駒台・駒の動き・玉方の応手・詰みの演出は本番と同じ部品を使う。
 */
export function TsumeShogiTutorial({
  open,
  playStart,
  onClose,
}: TsumeShogiTutorialProps) {
  const [progress, setProgress] = useState<TsumeShogiTutorialProgress>(() =>
    startTutorial(tsumeShogiTutorial),
  );
  // 盤面の操作の知らせ。本番と同じ効果音を鳴らす。最初からやり直しても前の回と重ならない `id` を振る。
  const [operation, setOperation] = useState<TsumeShogiOperation | null>(null);
  const operationIdRef = useRef(0);
  // 待ったで盤面に戻ってきた最後の組。指し直したときのように動かして見せない。
  const [restoredTurn, setRestoredTurn] =
    useState<TsumeShogiSessionTurn | null>(null);
  const [steppedProgress, setSteppedProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  const [waitedProgress, setWaitedProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  // 手を引いている間に指していない所を押されたら、押されるたびに印の線を短く濃くして、指を出し直す。
  const [recall, setRecall] = useState<{
    progress: TsumeShogiTutorialProgress;
    id: number;
  } | null>(null);
  const situation = getTutorialSituation(tsumeShogiTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const session = progress.boardState;
  const sessionPhase = getTsumeShogiSessionPhase(session);
  const playing = progress.phase === "playing";
  const recallId = recall?.progress === progress ? recall.id : null;
  // 手を引いている間は、玉方が応じて手順が進んだら少し待って指す。手を離した後は、手が止まったら指す。
  const cueDelayMs = !playing
    ? null
    : guiding
      ? progress === steppedProgress
        ? NEXT_STEP_CUE_DELAY_MS
        : 0
      : IDLE_HINT_DELAY_MS;
  const waited = waitedProgress === progress;
  const cue: TsumeShogiTutorialCue | null = !playing
    ? null
    : step
      ? cueDelayMs === 0 || waited || recallId !== null
        ? getTsumeShogiTutorialStepCue(step, session)
        : null
      : findTsumeShogiTutorialHint(session, waited);
  const kingSquare = findTsumeShogiDefenderKing(session.puzzleState);

  useTsumeShogiSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    kingSquare,
  );

  useEffect(() => {
    if (!open || cueDelayMs === null || cueDelayMs === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setWaitedProgress(progress),
      cueDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, cueDelayMs]);

  const dispatch = useCallback(
    (action: TsumeShogiTutorialAction) => {
      const next = performTutorialAction(tsumeShogiTutorial, progress, action);
      if (next === progress) {
        if (guiding && action.type !== "defender-reply") {
          setRecall((current) => ({
            progress,
            id: current?.progress === progress ? current.id + 1 : 0,
          }));
        }
        return;
      }
      setProgress(next);
      if (next.stepIndex !== progress.stepIndex) {
        setSteppedProgress(next);
      }
      const rewound =
        next.boardState.turns.length < progress.boardState.turns.length;
      if (rewound) {
        setRestoredTurn(next.boardState.turns.at(-1) ?? null);
        setOperation(null);
        return;
      }
      const operationType = describeTsumeShogiOperation(
        progress.boardState,
        next.boardState,
      );
      if (operationType) {
        operationIdRef.current += 1;
        setOperation({ id: operationIdRef.current, type: operationType });
      }
    },
    [progress, guiding],
  );

  // 本番と同じく、攻方が指してから間を置いて玉方の応手を盤面に指す。
  useEffect(() => {
    if (!open || !session.defenderReplyPending) {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "defender-reply" }),
      TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, session.defenderReplyPending, dispatch]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function reset(): void {
    setWaitedProgress(null);
    setSteppedProgress(null);
    setRecall(null);
    setOperation(null);
    setRestoredTurn(null);
    setProgress(startTutorial(tsumeShogiTutorial));
  }

  // 始めの盤面はもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    reset();
    setProgress(finishTutorialIntro);
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき入口から始まるようにする。
  function handleClose(): void {
    reset();
    onClose();
  }

  function handleStartPlay(): void {
    reset();
    playStart?.onStart();
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 手順の間は、駒を選んだら行き先の一言に替える。手を離した後は、残りの王手の数と、玉に逃げられたことで応える。
   * 着手させなかった手のわけは、手が止まって次の手を指したら下げる。
   */
  function getMessage(): TutorialMessage {
    if (playing && step) {
      return describeTsumeShogiTutorialStep(step, session);
    }
    if (playing && (!progress.violated || (waited && cue !== null))) {
      return describeTsumeShogiTutorialFreePlay(session);
    }
    return getTutorialMessage(tsumeShogiTutorial, progress, {
      entry: finish.entry,
      // 1回の押す操作で決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  const shownMovesTurn = session.turns.at(-1);
  const positionBeforeLastTurn =
    session.turns.at(-2)?.positionAfterDefense ??
    session.problem.initialPosition;
  const shownMoves = listTsumeShogiShownMoves(
    shownMovesTurn,
    positionBeforeLastTurn,
    session.defenderReplyPending,
  );
  const acceptsInput = playing && sessionPhase === "attacker";
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : playing && sessionPhase === "defender"
      ? "waiting"
      : "unavailable";
  const pointer = cue && { recallId };
  const selectedHandPieceType =
    session.selection?.type === "hand" ? session.selection.pieceType : null;

  /**
   * 入口でも、詰み上がりではなく始めの盤面を見せる。詰み上がりの形がそのまま解き方になるので見せない。
   * 入口の場面は共通の部品で受けるが、どちらの場面でも始めの盤面を描くので、始めるときに盤面は替わらない。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    return (
      <TutorialCrossFadeIntroScene
        scene={scene}
        playing={scenePlaying}
        onSceneEnd={onSceneEnd}
      >
        {() => renderBoardGroup(scene === "goal")}
      </TutorialCrossFadeIntroScene>
    );
  }

  function renderBoardGroup(showsIntro: boolean) {
    return (
      <TsumeShogiPieceDefs>
        <div
          className="flex size-full items-end justify-center"
          style={tutorialBoardGroupSizeStyle}
        >
          <TsumeShogiBoardGroup
            board={
              <TsumeShogiClearAnimation
                active={progress.phase === "solved"}
                onClearAnimationComplete={handleClearAnimationComplete}
              >
                <TsumeShogiBoard
                  boardPieces={listTsumeShogiBoardPieces(session.puzzleState)}
                  boardPieceIds={listTsumeShogiBoardPieceIds(
                    session.problem.initialPosition,
                    session.turns,
                    session.defenderReplyPending,
                  )}
                  selection={session.selection}
                  shownMoves={shownMoves}
                  shownMovesRestored={
                    shownMovesTurn !== undefined &&
                    shownMovesTurn === restoredTurn
                  }
                  promotionChoice={session.promotionChoice}
                  rejection={session.rejection}
                  mated={
                    progress.phase === "solved" ||
                    progress.phase === "completed"
                  }
                  interactionDisabled={showsIntro || !acceptsInput}
                  tutorialPointer={
                    pointer && cue?.type === "square"
                      ? { square: cue.square, ...pointer }
                      : null
                  }
                  onSelectSquare={(square) =>
                    dispatch({ type: "square", square })
                  }
                  onChoosePromotion={(promote) =>
                    dispatch({ type: "promotion", promote })
                  }
                />
              </TsumeShogiClearAnimation>
            }
            hand={
              <TsumeShogiHand
                hand={getTsumeShogiHand(session.puzzleState, "attacker")}
                selectedPieceType={selectedHandPieceType}
                availability={showsIntro ? "waiting" : handAvailability}
                rejection={session.rejection}
                // 本番の背の低い画面と同じく、待ったを駒台の左に置く。
                leadingAction={
                  <span className="relative flex rounded-full">
                    <UndoButton
                      disabled={
                        !playing ||
                        sessionPhase === "defender" ||
                        !canUndoTsumeShogiTutorial(session)
                      }
                      onUndo={() => dispatch({ type: "undo" })}
                    />
                    {pointer && cue?.type === "undo" && (
                      <TutorialCue kind="pointer" recallId={recallId} />
                    )}
                  </span>
                }
                tutorialPointer={
                  pointer && cue?.type === "hand"
                    ? { pieceType: cue.pieceType, ...pointer }
                    : null
                }
                onSelectHandPiece={(pieceType) =>
                  dispatch({ type: "hand", pieceType })
                }
              />
            }
            status={
              // 待ったを指す指は待ったのすぐ下、直前の手の行の左端に出るので、行の文字を待ったの幅だけ右から始めて、指に隠させない。
              <div className="pl-12">
                <TsumeShogiPlayStatus
                  plies={session.problem.plies}
                  phase={sessionPhase}
                  shownMoves={shownMoves}
                  precedingMoveTo={
                    session.turns.at(-2)?.defenderMove?.to ?? null
                  }
                />
              </div>
            }
          />
        </div>
      </TsumeShogiPieceDefs>
    );
  }

  return (
    <TutorialStage
      open={open}
      title={TSUME_SHOGI_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<TsumeShogiBackground />}
      intro={tsumeShogiTutorial.intro}
      recap={tsumeShogiTutorial.rules.map((rule) => rule.label)}
      message={getMessage()}
      phase={progress.phase}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getTsumeShogiTutorialProgressRatio(session)
      }
      progressStepCount={TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      onClose={handleClose}
    />
  );
}
