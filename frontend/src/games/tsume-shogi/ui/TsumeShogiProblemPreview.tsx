import type { CSSProperties } from "react";

import { listTsumeShogiBoardPieceIds } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import {
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  TsumeShogiBoardGroup,
  tsumeShogiBoardGroupSizeStyle,
} from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import { TsumeShogiHand } from "@/games/tsume-shogi/ui/TsumeShogiHand";

type TsumeShogiProblemPreviewProps = {
  problem: TsumeShogiProblem;
};

/**
 * 幅 390px のスマートフォンのプレイ画面での、駒箱の札・盤・駒台・直前の手の行の並びの大きさ。
 * 駒台の高さや持駒の大きさは px・rem で決まっていて盤の幅に連れて縮まないので、この大きさで並べてから全体を縮め、
 * 小さな枠でもプレイ画面と同じ釣り合いに見せる。
 */
const PREVIEW_LAYOUT_WIDTH_PX = 390;
const PREVIEW_LAYOUT_HEIGHT_PX = 509;

const previewLayoutStyle = {
  ...tsumeShogiBoardGroupSizeStyle,
  width: `${PREVIEW_LAYOUT_WIDTH_PX}px`,
  height: `${PREVIEW_LAYOUT_HEIGHT_PX}px`,
  // tan(atan2(a, b)) は長さどうしの比 a / b を数として求める。置かれた枠（`container-type: size`）に収まる倍率にする。
  scale: `min(tan(atan2(100cqw, ${PREVIEW_LAYOUT_WIDTH_PX}px)), tan(atan2(100cqh, ${PREVIEW_LAYOUT_HEIGHT_PX}px)))`,
} as CSSProperties;

function ignoreSelection() {}

/**
 * 1問の、始めたときの盤面。プレイ画面と同じ盤・攻方の駒台・玉方の駒箱の札を、置かれた枠に収まる大きさで中央に描く。操作は受けない。
 */
export function TsumeShogiProblemPreview({
  problem,
}: TsumeShogiProblemPreviewProps) {
  const { initialPosition } = problem;
  return (
    <TsumeShogiPieceDefs>
      <div
        className="flex shrink-0 items-center justify-center [container-type:size]"
        style={previewLayoutStyle}
      >
        <TsumeShogiBoardGroup
          board={
            <TsumeShogiBoard
              boardPieces={listTsumeShogiBoardPieces(initialPosition)}
              boardPieceIds={listTsumeShogiBoardPieceIds(
                initialPosition,
                [],
                false,
              )}
              selection={null}
              shownMoves={[]}
              shownMovesRestored
              promotionChoice={null}
              rejection={null}
              mated={false}
              interactionDisabled
              onSelectSquare={ignoreSelection}
              onChoosePromotion={ignoreSelection}
            />
          }
          hand={
            <TsumeShogiHand
              hand={getTsumeShogiHand(initialPosition, "attacker")}
              selectedPieceType={null}
              availability="available"
              rejection={null}
              onSelectHandPiece={ignoreSelection}
            />
          }
          status={null}
        />
      </div>
    </TsumeShogiPieceDefs>
  );
}
