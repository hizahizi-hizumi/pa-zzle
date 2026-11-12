import type { CSSProperties } from "react";

import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import { createEmptyReflectionBoard } from "@/games/reflection/puzzle/board";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionStock } from "@/games/reflection/ui/ReflectionStock";

type ReflectionProblemPreviewProps = {
  problem: ReflectionProblem;
};

/**
 * 幅 390px のスマートフォンのプレイ画面での、盤面の一辺・盤面と手持ちのピースの間・手持ちのピースの行の高さ。
 * 手持ちのピースの行は px・rem で決まっていて盤面の大きさに連れて縮まないので、この大きさで並べてから全体を縮め、
 * 小さな枠でもプレイ画面と同じ釣り合いに見せる。
 */
const PREVIEW_BOARD_SIZE_PX = 382;
const PREVIEW_STOCK_GAP_PX = 8;
const PREVIEW_STOCK_HEIGHT_PX = 52;
const PREVIEW_LAYOUT_HEIGHT_PX =
  PREVIEW_BOARD_SIZE_PX + PREVIEW_STOCK_GAP_PX + PREVIEW_STOCK_HEIGHT_PX;

const previewLayoutStyle = {
  width: `${PREVIEW_BOARD_SIZE_PX}px`,
  height: `${PREVIEW_LAYOUT_HEIGHT_PX}px`,
  rowGap: `${PREVIEW_STOCK_GAP_PX}px`,
  // tan(atan2(a, b)) は長さどうしの比 a / b を数として求める。置かれた枠（`container-type: size`）に収まる倍率にする。
  scale: `min(tan(atan2(100cqw, ${PREVIEW_BOARD_SIZE_PX}px)), tan(atan2(100cqh, ${PREVIEW_LAYOUT_HEIGHT_PX}px)))`,
} satisfies CSSProperties;

function ignoreSelection() {}

/**
 * 1問の、始めたときの盤面。ピースを置いていない盤面と外周ヒント、その下の手持ちのピースを、
 * プレイ画面と同じ姿で、置かれた枠に収まる大きさで中央に描く。操作は受けない。
 */
export function ReflectionProblemPreview({
  problem,
}: ReflectionProblemPreviewProps) {
  const { size, clues, inventory } = problem;
  const board = createEmptyReflectionBoard(size);
  return (
    <div className="flex shrink-0 flex-col" style={previewLayoutStyle}>
      <div className="aspect-square w-full">
        <ReflectionBoard
          board={board}
          clues={clues}
          clueMatches={listReflectionClueMatches(board, clues)}
          selection={null}
          laser={null}
          interactionDisabled
          progress="playing"
          onSelectCell={ignoreSelection}
          onSelectClue={ignoreSelection}
          onRemovePiece={ignoreSelection}
          onClearAnimationComplete={ignoreSelection}
        />
      </div>
      {/* 押せない姿（薄い色）ではなく、遊び始めたときの押せる姿で見せる。置かれた枠が操作を受けない。 */}
      <ReflectionStock
        inventory={inventory}
        stock={inventory}
        selection={null}
        selectedCell={null}
        disabled={false}
        onSelectStockPiece={ignoreSelection}
      />
    </div>
  );
}
