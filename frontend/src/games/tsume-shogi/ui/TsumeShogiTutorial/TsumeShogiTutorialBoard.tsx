import { TutorialCue } from "@/components/TutorialCue";
import type { TutorialBoardIntro } from "@/components/TutorialOverlay";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { UndoButton } from "@/components/UndoButton";
import {
  listTsumeShogiBoardPieceIds,
  listTsumeShogiShownMoves,
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
import type {
  TsumeShogiTutorialAction,
  TsumeShogiTutorialBoardState,
  TsumeShogiTutorialMark,
  TsumeShogiTutorialRuleId,
} from "@/games/tsume-shogi/tutorial/tutorial";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { TsumeShogiBoardGroup } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiHand";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlayStatus";
import type { TutorialProgress } from "@/games/tutorial";

type TsumeShogiTutorialProgress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

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

export function TsumeShogiTutorialBoard({
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

  return (
    <TsumeShogiPieceDefs>
      <div className="flex size-full items-start justify-center">
        <TsumeShogiBoardGroup
          context="tutorial"
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
