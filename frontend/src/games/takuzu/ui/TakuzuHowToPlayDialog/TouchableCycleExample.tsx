import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  createTakuzuExampleBoard,
  findTakuzuExampleHintCell,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type {
  TakuzuHowToPlayFigureBoard,
  TakuzuHowToPlayOperationFigures,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";
import { CycleFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableCycleExample/CycleFigure";
import { useTouchableExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/use-touchable-example";

type TouchableCycleExampleProps = {
  /** 巡る順の図。押すときの順か、右クリックのときの逆の順。 */
  cycle: TakuzuHowToPlayOperationFigures;
  /** 触れるマス1つ。巡る順の最初のマスと同じ姿から始め、図と同じ向きに押す所を示す。 */
  board: TakuzuHowToPlayFigureBoard;
};

/**
 * 巡る順の図と、本番のマス1つの触れる例。マスは図の真下の中央に置く。
 * マスは本番と同じく、押すと押す順に、右クリックで逆の順に変わり、図の中で今の姿にあたるマスを輪郭で示す。
 * マスは、ルールの例と同じく、押す所の手がかりを付ける。
 */
export function TouchableCycleExample({
  cycle,
  board,
}: TouchableCycleExampleProps) {
  const { example, tap } = useTouchableExample(board);
  const cell = example.board.cells[0] ?? null;
  const currentFrame = cycle.steps.findIndex(
    (frame) => createTakuzuExampleBoard(frame).board.cells[0] === cell,
  );
  const hintCell = findTakuzuExampleHintCell(board, example);

  return (
    // 戻る線と下のマスの間を、例の面の上の余白と同じだけ空ける。
    <div className="flex flex-col items-center gap-8">
      <CycleFigure cycle={cycle} currentFrame={currentFrame} />
      <HowToPlayExample
        figure={
          <HowToPlayFigure
            example={example}
            size="example"
            pressedCells={hintCell === null ? undefined : [hintCell]}
            pressDirection={board.pressDirection}
            onTapCell={tap}
          />
        }
      />
    </div>
  );
}
