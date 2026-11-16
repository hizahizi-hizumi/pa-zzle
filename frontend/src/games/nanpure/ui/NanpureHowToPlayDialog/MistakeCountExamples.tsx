import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { getNanpureExampleMarks } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import type { NanpureHowToPlayFlowFigure } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/nanpure/ui/NanpureHowToPlayDialog/HowToPlayBoard";

type MistakeCountExample = {
  figure: NanpureHowToPlayFlowFigure;
  /** 図の下に、数え方の前に添える流れ。 */
  flow: string;
};

type MistakeCountExamplesProps = {
  examples: readonly MistakeCountExample[];
};

/**
 * 図のマスの大きさ。広い画面ではルールの例と同じ 52px にする。
 * 狭い画面でも、ルールの例と同じ大きさ（40px）を上限にし、3つの姿と2つの矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、3マスと、姿の外枠（3 × 4px）、矢印のまとまり（2 × 3文字 × 14px）、その間（4 × 8px）。
 */
const figureCellSizeClassName =
  "[--nanpure-figure-cell:min(40px,calc((100cqw-128px)/3))] lg:[--nanpure-figure-cell:52px]";

/**
 * ミスの数え方を、答えと違う数字を入れてから直すまでの姿の流れで並べる押せない図。
 * 姿は本番の盤面と同じ色で描く。どの姿も1つのマスだけなので、操作したマスは矢印の言葉で示し、選んだマスの地は付けない。
 * 選んだ地を付けると、取り消して空きに戻った姿が、入れ終えた姿のように見えるため。
 * 図の下に、流れと、本番の数え方で数えたミスの回数を「→ ミス 1回」の形で添える。
 */
export function MistakeCountExamples({ examples }: MistakeCountExamplesProps) {
  return (
    // 図のマスの大きさを CSS 変数で渡す。自分では箱を作らず、図の並びを変えない。
    <div className={`contents ${figureCellSizeClassName}`}>
      <HowToPlayFlowFigures
        renderFrame={({ region, session }) => {
          const marks = getNanpureExampleMarks(session);
          return (
            <HowToPlayBoard
              region={region}
              board={session.puzzleState}
              clues={session.problem.clues}
              notes={session.notes}
              selectedCellIndex={null}
              conflictCellIndices={marks.conflictCellIndices}
              mistakeCellIndices={marks.mistakeCellIndices}
            />
          );
        }}
        figures={examples.map(({ figure, flow }) => ({
          frames: figure.frames.map((session) => ({
            region: figure.region,
            session,
          })),
          steps: figure.steps,
          caption: flow,
          count: {
            label: "ミス",
            value: `${figure.frames.at(-1)?.mistakeCount ?? 0}回`,
          },
        }))}
      />
    </div>
  );
}
