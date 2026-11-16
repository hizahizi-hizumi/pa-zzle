import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import {
  chordMinesweeperExampleCell,
  createMinesweeperExampleBoard,
  type MinesweeperExampleBoard,
  revealMinesweeperExampleCell,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import {
  type MinesweeperMistakeCountMove,
  mistakeCountMoves,
  mistakeCountStart,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayBoard";

type MistakeCountFlowsProps = {
  /** 数えるものの呼び名（結果画面の採点基準と同じ）。 */
  measure: string;
};

/** 流れの1コマ。`move` は、このコマに至る手。最初のコマには無い。 */
type MistakeCountFrame = {
  example: MinesweeperExampleBoard;
  move?: MinesweeperMistakeCountMove;
};

/**
 * 図のマスの大きさ。広い画面ではルールの例と同じ 48px にする。
 * 狭い画面でも、ルールの例と同じ大きさ（40px）を上限にし、2つの姿と矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、6マスと、2つの盤面のマスの間と縁の内側の余白（2 × 24px）、矢印のまとまり（2文字の言葉より広い矢印の最小の 28px）、その間（2 × 8px）。
 */
const figureCellSizeClassName =
  "[--minesweeper-figure-cell:min(40px,calc((100cqw-92px)/6))] lg:[--minesweeper-figure-cell:48px]";

function play(move: MinesweeperMistakeCountMove): MistakeCountFrame[] {
  const start = createMinesweeperExampleBoard(mistakeCountStart);
  const next =
    move.action === "chord"
      ? chordMinesweeperExampleCell(start, move.cellIndex)
      : revealMinesweeperExampleCell(start, move.cellIndex);
  return [{ example: start }, { example: next, move }];
}

function countSteppedMines(frames: readonly MistakeCountFrame[]): number {
  return frames.at(-1)?.example.puzzle.steppedMineCellIndices.length ?? 0;
}

/**
 * 踏んだ地雷の数え方を、同じ始まりの盤面から、地雷のマスを開く流れと、旗の場所が違う数字を押してまとめて開く流れで並べる押せない図。
 * 手は本番の関数で打ち、図に添える数は、手の後の盤面の踏んだ地雷の数から出す。
 * 2つ目の姿では、その前に押したマスを無彩の枠で囲む。
 */
export function MistakeCountFlows({ measure }: MistakeCountFlowsProps) {
  const flows = [
    {
      frames: play(mistakeCountMoves.mine),
      step: "開く",
      caption: "地雷のマスを/開く",
    },
    {
      frames: play(mistakeCountMoves.chord),
      step: "押す",
      caption: "旗の/場所が/違う/2を/押す",
    },
  ];
  return (
    // 図のマスの大きさを CSS 変数で渡す。自分では箱を作らず、図の並びを変えない。
    <div className={`contents ${figureCellSizeClassName}`}>
      <HowToPlayFlowFigures
        renderFrame={(frame: MistakeCountFrame) => (
          <HowToPlayBoard
            example={frame.example}
            size="inherited"
            pressedCellIndex={frame.move?.cellIndex}
          />
        )}
        figures={flows.map(({ frames, step, caption }) => ({
          frames,
          steps: [step],
          caption,
          count: { label: measure, value: `${countSteppedMines(frames)}個` },
        }))}
      />
    </div>
  );
}
