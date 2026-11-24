import { type ReactNode, useCallback, useState } from "react";

import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import type { MagicSquareSession } from "@/games/magic-square/session/session";
import {
  getMagicSquareFrameUnits,
  type MagicSquareBoardRegion,
} from "@/games/magic-square/ui/board/board-layout";
import {
  MagicSquareBoard,
  type MagicSquareCellRejection,
} from "@/games/magic-square/ui/board/MagicSquareBoard";

/**
 * 例のマスの大きさ。1行だけの例も盤面の全体の例も同じ大きさにし、ゴールの盤面のマスと見比べて同じ物に見える大きさにする。
 * スマートフォンでは数の札の高さ（44px）より一回り大きい 52px にし、面の広い PC では、ゴールの盤面の大きなマスに近づくよう、
 * 面の幅に合わせて 72px まで大きくする。狭い画面では、盤面の幅が面の内側の幅に収まる大きさにする。
 */
export const MAGIC_SQUARE_EXAMPLE_CELL = "clamp(52px, 12cqw, 72px)";

/** 例の盤面の幅。範囲の列と帯の幅をマスの数で表したものに、マスの大きさを掛けた幅。 */
export function getMagicSquareExampleWidth(columns: number): string {
  return `min(100cqw, ${columns} * ${MAGIC_SQUARE_EXAMPLE_CELL})`;
}

/**
 * 例の盤面の下に並んだ数の幅。本番のプレイ画面の数の欄の幅（36rem の欄から左右 0.5rem を除いた幅）を上限に、面の内側の幅に広げ、
 * 数の札を本番と同じ形に近づける。
 */
export const MAGIC_SQUARE_EXAMPLE_PAD_WIDTH = "min(100cqw, 35rem)";

type ExampleBoardProps = {
  session: MagicSquareSession;
  region: MagicSquareBoardRegion;
  selectedCellIndex: number | null;
  /** 盤面の幅。渡さなければ例の幅（`getMagicSquareExampleWidth`）にする。 */
  width?: string;
  /** 押せない図では渡さない。 */
  onSelectCell?: (cellIndex: number) => void;
  rejection?: MagicSquareCellRejection | null;
  renderCellOverlay?: (cellIndex: number) => ReactNode;
};

function ignore(): void {}

/**
 * 例の盤面。本番の盤面部品で、範囲のマスと列の合計を描く。解き終えた盤面では、本番と同じクリア演出を1回だけ返す。
 */
export function ExampleBoard({
  session,
  region,
  selectedCellIndex,
  width,
  onSelectCell,
  rejection = null,
  renderCellOverlay,
}: ExampleBoardProps) {
  const { puzzleState, problem } = session;
  const units = getMagicSquareFrameUnits(puzzleState.size, region);
  const [clearAnimationDone, setClearAnimationDone] = useState(false);
  // 盤面部品は、演出の完了を知らせる関数が替わると演出を始め直すので、描き直しても同じ関数を渡す。
  const finishClearAnimation = useCallback(
    () => setClearAnimationDone(true),
    [],
  );
  return (
    <div
      style={{
        width: width ?? getMagicSquareExampleWidth(units.columns),
        aspectRatio: `${units.columns} / ${units.rows}`,
      }}
    >
      <MagicSquareBoard
        givens={problem.givens}
        board={puzzleState}
        memos={puzzleState.memos}
        lineEvaluations={listMagicSquareLineEvaluations(puzzleState)}
        selectedCellIndex={selectedCellIndex}
        interactionDisabled={onSelectCell === undefined}
        clearing={session.status === "cleared" && !clearAnimationDone}
        region={region}
        rejection={rejection}
        renderCellOverlay={renderCellOverlay}
        onSelectCell={onSelectCell ?? ignore}
        onClearAnimationComplete={finishClearAnimation}
      />
    </div>
  );
}
