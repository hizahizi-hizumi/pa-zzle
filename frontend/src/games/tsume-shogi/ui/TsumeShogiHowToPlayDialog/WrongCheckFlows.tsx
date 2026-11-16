import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import type { TsumeShogiSession } from "@/games/tsume-shogi/session/session";
import { tsumeShogiBoardFrameStyle } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import { getTsumeShogiExampleView } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import { wrongCheckFlowFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/HowToPlayBoard";
import { listTsumeShogiWrongCheckFlows } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/wrong-check-flows";

const flows = listTsumeShogiWrongCheckFlows();

/**
 * コマの升の幅。1段に3つのコマ（3筋と淡く消える端と細い縁で、升の幅の約 3.4 倍）と、矢印の列2つ（1行3文字の名前、42px ずつ）と
 * 間4つ（8px ずつ）が面の内側に収まる大きさにし、例の升より小さい 3rem までにする。
 */
const frameSquareClassName =
  "[--tsume-shogi-figure-square:min(3rem,calc((100cqw-7.25rem)/10.25))]";

/** コマ1つ。前のコマからの操作で駒を指した升を、押した所を囲む枠で示す。最初のコマには付けない。 */
function renderFrame(
  session: TsumeShogiSession,
  previous: TsumeShogiSession | undefined,
) {
  const view = getTsumeShogiExampleView(session);
  return (
    <span className={frameSquareClassName} style={tsumeShogiBoardFrameStyle}>
      <HowToPlayBoard
        crop={wrongCheckFlowFigure.crop}
        coordinates={false}
        boardPieces={view.boardPieces}
        boardPieceIds={view.boardPieceIds}
        selection={null}
        shownMoves={view.shownMoves}
        shownMovesRestored
        promotionChoice={null}
        rejection={null}
        mated={false}
        operatedSquare={
          previous === undefined
            ? null
            : (session.turns.at(-1)?.attackerMove.to ?? null)
        }
      />
    </span>
  );
}

/**
 * 誤王手の数え方の流れ。本番の盤面と同じ見た目の押せないコマを、同じ始まりの盤面から並べ、
 * 王手で駒を指した升を枠で囲み、玉方が逃れた升は本番と同じ升の地で示す。数えた回数は本番の session の数え方で求める。
 */
export function WrongCheckFlows() {
  return (
    <div inert>
      <HowToPlayFlowFigures
        figures={flows.map(({ frames, steps, caption, wrongCheckCount }) => ({
          frames,
          steps,
          caption,
          count: { label: "誤王手", value: `${wrongCheckCount}回` },
        }))}
        renderFrame={renderFrame}
      />
    </div>
  );
}
