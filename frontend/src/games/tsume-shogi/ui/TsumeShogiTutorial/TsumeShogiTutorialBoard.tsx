import { TutorialCue } from "@/components/TutorialCue";
import { UndoButton } from "@/components/UndoButton";
import {
  listTsumeShogiBoardPieceIds,
  listTsumeShogiShownMoves,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  getTsumeShogiSessionPhase,
  type TsumeShogiSessionTurn,
} from "@/games/tsume-shogi/session/session";
import type {
  TsumeShogiTutorialAction,
  TsumeShogiTutorialBoardState,
  TsumeShogiTutorialMark,
} from "@/games/tsume-shogi/tutorial/tutorial";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiBoardGroup } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiHand";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlayStatus";

type TsumeShogiTutorialBoardProps = {
  /** 盤に見せる状態。入口でゴールを見せる間はゴールの盤面。 */
  state: TsumeShogiTutorialBoardState;
  /** 入口のゴールの盤面か。詰んだ玉を見せ、操作と印を出さない。 */
  goalShown: boolean;
  clearing: boolean;
  mated: boolean;
  /** 盤と持駒を押せるか。玉方の応手を待つ間と、解いていない場面では押せない。 */
  acceptsInput: boolean;
  /** 解いている間か。待ったを押せる場面を決める。 */
  solving: boolean;
  /** 応手を待つ短い間か。持駒の見た目を変えずに押せなくする。 */
  waitingForReply: boolean;
  mark: TsumeShogiTutorialMark | null;
  recallId: number | null;
  restoredTurn: TsumeShogiSessionTurn | null;
  /** 盤の中だけを薄く覆い、元の明るさで残す升。覆わないときは `null`。 */
  spotlitSquares: readonly TsumeShogiSquare[] | null;
  canUndo: boolean;
  onAction: (action: TsumeShogiTutorialAction) => void;
  onClearAnimationComplete: () => void;
};

/**
 * 盤の升は小さく、指が決め手の駒を隠すので、升と待ったの印は輪郭だけにする。持駒の印には指を添える。
 */
export function TsumeShogiTutorialBoard({
  state,
  goalShown,
  clearing,
  mated,
  acceptsInput,
  solving,
  waitingForReply,
  mark,
  recallId,
  restoredTurn,
  spotlitSquares,
  canUndo,
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
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : waitingForReply || goalShown
      ? "waiting"
      : "unavailable";
  const selectedHandPieceType =
    state.selection?.type === "hand" ? state.selection.pieceType : null;

  return (
    <TsumeShogiBoardGroup
      board={
        <TsumeShogiClearAnimation
          active={clearing}
          onClearAnimationComplete={onClearAnimationComplete}
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
              goalShown || (lastTurn !== undefined && lastTurn === restoredTurn)
            }
            promotionChoice={state.promotionChoice}
            rejection={state.rejection}
            mated={mated}
            interactionDisabled={!acceptsInput}
            tutorialMark={
              mark?.type === "square" ? { square: mark.square, recallId } : null
            }
            spotlitSquares={spotlitSquares}
            onSelectSquare={(square) => onAction({ type: "square", square })}
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
          // 本番の背の低い画面と同じく、待ったを駒台の左に置く。入口のゴールの盤面には出さない。
          leadingAction={
            !goalShown && (
              <span className="relative flex rounded-full">
                <UndoButton
                  disabled={!solving || !canUndo}
                  onUndo={() => onAction({ type: "undo" })}
                />
                {mark?.type === "undo" && (
                  <TutorialCue kind="mark" recallId={recallId} />
                )}
              </span>
            )
          }
          tutorialMark={
            mark?.type === "hand"
              ? { pieceType: mark.pieceType, recallId }
              : null
          }
          onSelectHandPiece={(pieceType) =>
            onAction({ type: "hand", pieceType })
          }
        />
      }
      status={
        // 逃れられたわけは一言で伝えるので、手数の知らせは出さない。狭い盤でも棋譜を切らずに見せる。
        <TsumeShogiPlayStatus
          phase={goalShown ? "cleared" : sessionPhase}
          shownMoves={goalShown ? [] : shownMoves}
          precedingMoveTo={state.turns.at(-2)?.defenderMove?.to ?? null}
        />
      }
    />
  );
}
