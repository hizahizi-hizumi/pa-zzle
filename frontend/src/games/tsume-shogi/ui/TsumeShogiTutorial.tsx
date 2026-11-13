import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TutorialCue } from "@/components/TutorialCue";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
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
  type TsumeShogiHandPieceType,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  canUndoTsumeShogiSession,
  getTsumeShogiSessionPhase,
  type TsumeShogiSessionTurn,
} from "@/games/tsume-shogi/session/session";
import {
  findTsumeShogiTutorialHint,
  getTsumeShogiTutorialMark,
  type TsumeShogiTutorialAction,
  type TsumeShogiTutorialBoardState,
  type TsumeShogiTutorialMark,
  type TsumeShogiTutorialRuleId,
  type TsumeShogiTutorialSituation,
  tsumeShogiTutorial,
} from "@/games/tsume-shogi/tutorial/tutorial";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
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

/** 盤の欄の左右の余白はチュートリアルの画面が取っているので、盤を卓に置いて見せる左右の余白は重ねない。 */
const tutorialBoardGroupSizeStyle = {
  ...tsumeShogiBoardGroupSizeStyle,
  "--board-gutter": "0px",
} as CSSProperties;

/** 玉方が応じて次の手順へ進んでから、次の印を付けるまでの間。玉が動き終えるのを見届けてから、次の印に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 450;

const IDLE_HINT_DELAY_MS = 4000;

const goalState = tsumeShogiTutorial.goal();
const startState = tsumeShogiTutorial.start();

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。導入でゴールを見せる波は完成ではないので、解いたときだけ完成演出として鳴らす。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、玉方が応じて手順が進んだら少し待って付ける。手を離した後は手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: TsumeShogiTutorialProgress,
  guiding: boolean,
  steppedProgress: TsumeShogiTutorialProgress | null,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  return progress === steppedProgress ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/**
 * 手を引いている間に覆いから抜く盤の升。次に押す升、選んでいる駒、王手をかける玉と手順の決め手の升。
 * 印を付ける前は、直前に指した駒と玉を残して、その手で起きたことを見せる。
 */
function getSpotlitSquares(
  state: TsumeShogiTutorialBoardState,
  mark: TsumeShogiTutorialMark | null,
  keySquares: readonly TsumeShogiSquare[],
): TsumeShogiSquare[] {
  const king = findTsumeShogiDefenderKing(state.puzzleState);
  const lastAttackerMove = state.turns.at(-1)?.attackerMove;
  return [
    king,
    ...keySquares,
    ...(mark?.type === "square" ? [mark.square] : []),
    ...(state.selection?.type === "board" ? [state.selection.square] : []),
    ...(mark === null && lastAttackerMove ? [lastAttackerMove.to] : []),
  ];
}

export function TsumeShogiTutorial({
  open,
  playStart,
  onClose,
}: TsumeShogiTutorialProps) {
  const [progress, setProgress] = useState<TsumeShogiTutorialProgress>(() =>
    startTutorial(tsumeShogiTutorial),
  );
  // 盤面の操作の知らせ。最初からやり直しても前の回と重ならない `id` を振る。
  const [operation, setOperation] = useState<TsumeShogiOperation | null>(null);
  const operationIdRef = useRef(0);
  // 待ったで盤面に戻ってきた最後の組。指し直したときのように動かして見せない。
  const [restoredTurn, setRestoredTurn] =
    useState<TsumeShogiSessionTurn | null>(null);
  const [steppedProgress, setSteppedProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  // 手を引いている間に印の無い所を押されたら、押されるたびに印の線を短く濃くして戻す。
  const [recall, setRecall] = useState<{
    progress: TsumeShogiTutorialProgress;
    id: number;
  } | null>(null);
  const situation: TsumeShogiTutorialSituation = getTutorialSituation(
    tsumeShogiTutorial,
    progress,
  );
  const guiding = situation.step !== null;
  const session = progress.boardState;
  const sessionPhase = getTsumeShogiSessionPhase(session);
  const recallId = recall?.progress === progress ? recall.id : null;
  const cueDelayMs = getCueDelayMs(progress, guiding, steppedProgress);
  const cueShown =
    cueDelayMs === 0 ||
    recallId !== null ||
    (cueDelayMs !== null && idleProgress === progress);
  const target = !cueShown
    ? null
    : (situation.step?.target ?? findTsumeShogiTutorialHint(session));
  const mark = target ? getTsumeShogiTutorialMark(target, session) : null;
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
      () => setIdleProgress(progress),
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

  function restart(): void {
    setIdleProgress(null);
    setSteppedProgress(null);
    setRecall(null);
    setOperation(null);
    setRestoredTurn(null);
    setProgress(startTutorial(tsumeShogiTutorial));
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
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
   * 印の線を濃くし直したときは、前の違反の一言を下げて、印へ向かう手順の一言に戻す。
   * 手を離した後に止まって次の王手を示したときも、着手させなかった手の一言を下げて、詰ませる一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (recallId !== null && situation.step) {
      return situation.step.message;
    }
    if (!guiding && mark !== null && session.rejection !== null) {
      return tsumeShogiTutorial.freePlay;
    }
    return getTutorialMessage(tsumeShogiTutorial, progress, {
      entry: finish.entry,
      // 1回の押す操作で決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  function renderBoard({
    scene,
    playing,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    // 最初の手順の印は、導入の終わりに一言と同時に出す。
    const introMark =
      progress.phase === "intro" && messageShown && situation.step
        ? getTsumeShogiTutorialMark(situation.step.target, session)
        : null;
    return (
      <TsumeShogiTutorialBoard
        state={
          scene === "goal"
            ? goalState
            : scene === "start"
              ? startState
              : session
        }
        scene={scene}
        scenePlaying={playing}
        onSceneEnd={onSceneEnd}
        progress={progress}
        guiding={guiding}
        mark={progress.phase === "intro" ? introMark : mark}
        recallId={recallId}
        restoredTurn={restoredTurn}
        statusSpotlit={guiding && situation.step?.reason === "status"}
        keySquares={situation.step?.keySquares ?? []}
        acceptsInput={
          progress.phase === "playing" && sessionPhase === "attacker"
        }
        onAction={dispatch}
        onClearAnimationComplete={handleClearAnimationComplete}
      />
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={TSUME_SHOGI_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={tsumeShogiTutorial.intro}
      rules={tsumeShogiTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
      phase={progress.phase}
      guiding={progress.phase === "playing" && guiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}

type TsumeShogiTutorialBoardProps = {
  state: TsumeShogiTutorialBoardState;
  scene: TutorialBoardIntro["scene"];
  scenePlaying: boolean;
  onSceneEnd: () => void;
  progress: TsumeShogiTutorialProgress;
  guiding: boolean;
  mark: TsumeShogiTutorialMark | null;
  recallId: number | null;
  restoredTurn: TsumeShogiSessionTurn | null;
  /** 盤の下の、この手数では詰まないという知らせを、覆いから抜く。 */
  statusSpotlit: boolean;
  keySquares: readonly TsumeShogiSquare[];
  acceptsInput: boolean;
  onAction: (action: TsumeShogiTutorialAction) => void;
  onClearAnimationComplete: () => void;
};

function TsumeShogiTutorialBoard({
  state,
  scene,
  scenePlaying,
  onSceneEnd,
  progress,
  guiding,
  mark,
  recallId,
  restoredTurn,
  statusSpotlit,
  keySquares,
  acceptsInput,
  onAction,
  onClearAnimationComplete,
}: TsumeShogiTutorialBoardProps) {
  const sessionPhase = getTsumeShogiSessionPhase(state);
  const lastTurn = state.turns.at(-1);
  const positionBeforeLastTurn =
    state.turns.at(-2)?.positionAfterDefense ?? state.problem.initialPosition;
  const shownMoves = listTsumeShogiShownMoves(
    lastTurn,
    positionBeforeLastTurn,
    state.defenderReplyPending,
  );
  const mated =
    scene === "goal" ||
    (scene === null &&
      (progress.phase === "solved" || progress.phase === "completed"));
  const handAvailability: TsumeShogiHandAvailability =
    scene !== null
      ? "waiting"
      : acceptsInput
        ? "available"
        : progress.phase === "playing" && sessionPhase === "defender"
          ? "waiting"
          : "unavailable";
  const focusing = guiding && scene === null;
  const handMarkPieceType: TsumeShogiHandPieceType | null =
    mark?.type === "hand" ? mark.pieceType : null;
  const selectedHandPieceType =
    state.selection?.type === "hand" ? state.selection.pieceType : null;

  // 始まりの盤面は動かさずに見せる。
  useEffect(() => {
    if (scene === "start" && scenePlaying) {
      onSceneEnd();
    }
  }, [scene, scenePlaying, onSceneEnd]);

  return (
    <TsumeShogiPieceDefs>
      <div
        className="flex size-full items-start justify-center"
        style={tutorialBoardGroupSizeStyle}
      >
        <TsumeShogiBoardGroup
          board={
            <TsumeShogiClearAnimation
              active={
                scene === "goal" ? scenePlaying : progress.phase === "solved"
              }
              onClearAnimationComplete={
                scene === "goal" ? onSceneEnd : onClearAnimationComplete
              }
            >
              <TsumeShogiBoard
                boardPieces={listTsumeShogiBoardPieces(state.puzzleState)}
                boardPieceIds={listTsumeShogiBoardPieceIds(
                  state.problem.initialPosition,
                  state.turns,
                  state.defenderReplyPending,
                )}
                selection={state.selection}
                shownMoves={shownMoves}
                shownMovesRestored={
                  scene !== null ||
                  (lastTurn !== undefined && lastTurn === restoredTurn)
                }
                promotionChoice={state.promotionChoice}
                rejection={state.rejection}
                mated={mated}
                interactionDisabled={scene !== null || !acceptsInput}
                tutorialMark={
                  scene === null && mark?.type === "square"
                    ? { square: mark.square, recallId }
                    : null
                }
                spotlitSquares={
                  focusing
                    ? getSpotlitSquares(state, mark, keySquares)
                    : undefined
                }
                onSelectSquare={(square) =>
                  onAction({ type: "square", square })
                }
                onChoosePromotion={(promote) =>
                  onAction({ type: "promotion", promote })
                }
              />
            </TsumeShogiClearAnimation>
          }
          hand={
            <TsumeShogiHand
              hand={getTsumeShogiHand(state.puzzleState, "attacker")}
              selectedPieceType={selectedHandPieceType}
              availability={handAvailability}
              rejection={state.rejection}
              // 本番の背の低い画面と同じく、待ったを駒台の左に置く。導入の盤面には出さない。
              leadingAction={
                scene === null && (
                  <span className="relative flex rounded-full">
                    <UndoButton
                      disabled={
                        progress.phase !== "playing" ||
                        !canUndoTsumeShogiSession(state)
                      }
                      onUndo={() => onAction({ type: "undo" })}
                    />
                    <TutorialSpotlight
                      active={focusing && mark?.type === "undo"}
                      className="inset-0 rounded-full"
                    />
                    {mark?.type === "undo" && (
                      <TutorialCue kind="mark" recallId={recallId} />
                    )}
                  </span>
                )
              }
              tutorialMark={
                scene === null && handMarkPieceType
                  ? { pieceType: handMarkPieceType, recallId }
                  : null
              }
              spotlitPieceTypes={
                focusing
                  ? [handMarkPieceType, selectedHandPieceType].filter(
                      (type) => type !== null,
                    )
                  : undefined
              }
              onSelectHandPiece={(pieceType) =>
                onAction({ type: "hand", pieceType })
              }
            />
          }
          status={
            <>
              <TsumeShogiPlayStatus
                plies={state.problem.plies}
                phase={sessionPhase}
                shownMoves={shownMoves}
                precedingMoveTo={state.turns.at(-2)?.defenderMove?.to ?? null}
              />
              <TutorialSpotlight
                active={focusing && statusSpotlit}
                className="inset-0"
              />
            </>
          }
        />
      </div>
    </TsumeShogiPieceDefs>
  );
}
