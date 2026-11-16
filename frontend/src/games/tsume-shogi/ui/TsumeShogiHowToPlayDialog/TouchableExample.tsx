import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { getTsumeShogiHand } from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { tsumeShogiBoardFrameStyle } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiHand";
import {
  getTsumeShogiExampleHint,
  listTsumeShogiCandidateMarks,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import type { TsumeShogiHowToPlayExample } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { tsumeShogiFigureSquareClassName } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-size";
import { HowToPlayBoard } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/HowToPlayBoard";
import { ExampleCaption } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample/ExampleCaption";
import {
  describeTsumeShogiExampleCaption,
  listTsumeShogiExampleCaptionLines,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample/example-caption";
import { useTouchableExample } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample/use-touchable-example";
import { useTsumeShogiExampleView } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/use-tsume-shogi-example-view";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPieceBox";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlayStatus";
import { cn } from "@/lib/utils";

type TouchableExampleProps = {
  example: TsumeShogiHowToPlayExample;
};

/**
 * 触れる例。本番のプレイ画面と同じ並び（玉方の持駒の札・盤・駒台・盤の下の行）のうち、例に要るものを本番の部品で描き、
 * 押すと本番と同じく駒を選び・指し・成るかを選ばせ・着手させない手で駒を揺らし、間を置いて玉方が応じ、詰めば詰みの演出を見せる。
 * 持駒の無い例でも本番の駒台は描かず、盤だけを見せる。
 * 押す所の手がかりは、例が見せる手を順に、駒・行き先・成るかの選択肢に付ける。
 * 例の下の言葉は、今の盤面と最後に試した手から求め直す。
 */
export function TouchableExample({ example }: TouchableExampleProps) {
  const { board, progress, perform, completeClearAnimation } =
    useTouchableExample(example);
  const { session } = board;
  const view = useTsumeShogiExampleView(session);
  const playing = progress === "playing";
  const acceptsInput = playing && view.phase === "attacker";
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : playing && view.phase === "defender"
      ? "waiting"
      : "unavailable";
  const showsHand = Object.values(
    getTsumeShogiHand(example.problem.initialPosition, "attacker"),
  ).some((count) => count > 0);
  const hint = getTsumeShogiExampleHint(board, example);
  // 操作の例は言葉を添えない。言葉を添える例は、言葉の無い姿も言葉の行の場所を取る。
  const caption =
    example.caption.kind === "none" ? undefined : (
      <ExampleCaption
        line={describeTsumeShogiExampleCaption(board, example)}
        layers={listTsumeShogiExampleCaptionLines(example)}
      />
    );

  return (
    <HowToPlayExample
      figure={
        <div
          className={cn(
            "inline-flex flex-col gap-1",
            tsumeShogiFigureSquareClassName,
          )}
          style={tsumeShogiBoardFrameStyle}
        >
          {example.showsPieceBox ? (
            <div className="h-(--piece-box-height)">
              <TsumeShogiPieceBox />
            </div>
          ) : null}
          <TsumeShogiClearAnimation
            active={progress === "clearing"}
            onClearAnimationComplete={completeClearAnimation}
          >
            <HowToPlayBoard
              crop={example.crop}
              coordinates
              boardPieces={view.boardPieces}
              boardPieceIds={view.boardPieceIds}
              selection={session.selection}
              shownMoves={view.shownMoves}
              // 例の最初の姿に指してある手は、開いたときと元に戻したときに動かして見せない。
              shownMovesRestored={session.turns.length <= example.preludeTurns}
              promotionChoice={session.promotionChoice}
              rejection={session.rejection}
              mated={!playing}
              interactionDisabled={!acceptsInput}
              onSelectSquare={(square) => perform({ type: "square", square })}
              onChoosePromotion={(promote) =>
                perform({ type: "promotion", promote })
              }
              hint={hint}
              candidateMarks={
                example.caption.kind === "candidates"
                  ? listTsumeShogiCandidateMarks(
                      board,
                      example.caption.judge,
                      example.crop,
                    )
                  : []
              }
            />
          </TsumeShogiClearAnimation>
          {showsHand ? (
            <div className="h-(--komadai-height)">
              <TsumeShogiHand
                hand={view.attackerHand}
                selectedPieceType={
                  session.selection?.type === "hand"
                    ? session.selection.pieceType
                    : null
                }
                availability={handAvailability}
                rejection={session.rejection}
                hint={
                  hint?.type === "hand"
                    ? {
                        pieceType: hint.pieceType,
                        // 駒の右下の枚数を隠さず、駒台の縁にもかけないよう、指は右上の角の内側に置く。
                        mark: (
                          <HowToPlayPressHint
                            ground="light"
                            outline="square"
                            pointer="inside-corner"
                            corner="top-right"
                          />
                        ),
                      }
                    : null
                }
                onSelectHandPiece={(pieceType) =>
                  perform({ type: "hand", pieceType })
                }
              />
            </div>
          ) : null}
          {example.showsStatus ? (
            <div className="relative h-5">
              <TsumeShogiPlayStatus
                plies={session.problem.plies}
                phase={view.phase}
                shownMoves={view.shownMoves}
                precedingMoveTo={view.precedingMoveTo}
              />
            </div>
          ) : null}
        </div>
      }
      caption={caption}
    />
  );
}
