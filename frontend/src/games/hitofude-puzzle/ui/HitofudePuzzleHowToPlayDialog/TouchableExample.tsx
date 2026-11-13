import { HowToPlayExample } from "@/components/HowToPlayExample";
import type { HitofudePuzzleExtensionRejection } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  findHitofudePuzzleExampleHintCell,
  getHitofudePuzzleExampleBoard,
  getHitofudePuzzleExamplePath,
  listHitofudePuzzleExampleCandidates,
  listHitofudePuzzleExampleRemainingCells,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import type { HitofudePuzzleHowToPlayExample } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/HowToPlayBoard";
import { MoveCaption } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/MoveCaption";
import { ShapeCaption } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/ShapeCaption";
import { useTouchableExample } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/use-touchable-example";

/**
 * 図の下に添える判定。どちらも、触った後も今の盤面から本番の判定で出し直す。
 * - `shape`: すべてのマスを通れば完成（形のルール）。完成か、行き止まりか途中とあと何マス残るかを言う。
 * - `move`: 通れないマスのルール（同じマス・穴）。`rule` は例が教えるルールで弾かれる理由。
 *   今の先端の隣に手ごとの印を付けて凡例を添え、完成・行き止まり・弾かれたこととその理由・道が戻ったことは、その姿を言う。
 *   弾かれたことは、本番の×が点いている間だけ言う。
 * どちらも、残りのマスの数を言う間（行き止まり、形のルールの途中）は、残ったマスに印を付ける。
 */
export type TouchableExampleCaption =
  | { kind: "shape" }
  | { kind: "move"; rule: HitofudePuzzleExtensionRejection };

type TouchableExampleProps = {
  example: HitofudePuzzleHowToPlayExample;
  /** 渡さない例（操作の例）は、言葉を添えない。 */
  caption?: TouchableExampleCaption;
};

/**
 * 触れる例。本番の盤面部品で、本番の指の操作とまったく同じに、なぞる・押すと道が延び・縮み・戻り、
 * 延ばせないマスでは×を点けて先端を揺らす。ルールの例も操作の例も同じに動く。
 * 図の下の判定と盤面の手ごとの印は、触った後も今の盤面から本番の判定で出し直す。
 * 押す所の手がかりは、触る前の道から例が見せる手を順に押していく途中の姿でだけ、次に押すマスに付け、弾かれたら、道が変わるまで消す。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const touchable = useTouchableExample(example);
  const { example: board } = touchable;
  const candidates =
    caption?.kind === "move"
      ? listHitofudePuzzleExampleCandidates(board, caption.rule)
      : undefined;
  const remainingShown =
    caption === undefined
      ? false
      : caption.kind === "shape"
        ? !touchable.solved
        : touchable.isDeadEnd;

  function renderCaption() {
    if (caption === undefined) {
      return undefined;
    }
    if (caption.kind === "shape") {
      return <ShapeCaption example={board} />;
    }
    return (
      <MoveCaption
        example={board}
        blockedMarkShown={touchable.blockedMarkCell !== null}
        candidates={candidates ?? []}
      />
    );
  }

  return (
    <HowToPlayExample
      figure={
        <HowToPlayBoard
          board={getHitofudePuzzleExampleBoard(board)}
          path={getHitofudePuzzleExamplePath(board)}
          isDeadEnd={touchable.isDeadEnd}
          solved={touchable.solved}
          clearing={touchable.clearing}
          blockedMove={touchable.blockedMove}
          visibleColumns={example.visibleColumns}
          blockedMarkCell={touchable.blockedMarkCell}
          hintedCell={findHitofudePuzzleExampleHintCell(board)}
          candidates={candidates}
          remainingCells={
            remainingShown
              ? listHitofudePuzzleExampleRemainingCells(board)
              : undefined
          }
          onBeginStroke={touchable.beginStroke}
          onTraceStroke={touchable.traceStroke}
          onEndStroke={touchable.endStroke}
          onClearAnimationComplete={touchable.completeClearAnimation}
        />
      }
      caption={renderCaption()}
    />
  );
}
