import { ArrowRight } from "lucide-react";
import { Fragment } from "react";
import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { createTakuzuExampleBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type { TakuzuHowToPlayReplacementCountFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";

type ReplacementCountExample = {
  figure: TakuzuHowToPlayReplacementCountFigure;
  /** 図の下に、数え方の前に添える押し方。 */
  howToPress: string;
};

type ReplacementCountExamplesProps = {
  examples: readonly ReplacementCountExample[];
};

/**
 * 図のマスの大きさ。広い画面ではルールの例と同じ 56px にする。
 * 狭い画面でも、ルールの例と同じ大きさ（40px）を上限にし、3つの姿と2つの矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、6マスと、姿の格子の線と外枠（3 × 5px）、矢印のまとまり（2 × 28px）、その間（4 × 4px）。
 */
const figureCellSizeClassName =
  "[--takuzu-figure-cell:min(39px,calc((100cqw-90px)/6))] lg:[--takuzu-figure-cell:55px]";

/** 矢印に添える、姿を進める操作。 */
const pressWord = "押す";

/**
 * 置き直しに数える押し方と数えない押し方を、ルールの例と同じ面に並べる。押せない図なので、押す所の手がかりや指のアイコンは付けない。
 * 2つ目からの姿では、その前に押したマスを、本番のキーボードで選んだマスと同じ地と輪郭で示す。
 * どの押し方も、押す前から押した後までの姿を左から順に並べ、間に「押す」の言葉を添えた矢印を、盤面の高さの中央にそろえて置く。
 * 2つの押し方の姿は同じ列にそろえ、最初の姿の左端を合わせる。
 * 図の下に、押し方と、本番の数え方で数える置き直しの回数を「→ 置き直し 1回」の形で添える。回数は採点の項目名と同じ太字の本文にする。
 */
export function ReplacementCountExamples({
  examples,
}: ReplacementCountExamplesProps) {
  return (
    <HowToPlayExamplePanel arrangement="stacked">
      <div
        className={`grid grid-cols-[repeat(5,auto)] justify-center gap-x-1 gap-y-10 ${figureCellSizeClassName}`}
      >
        {examples.map(({ figure, howToPress }) => (
          <figure
            key={howToPress}
            className="col-span-5 grid grid-cols-subgrid items-center gap-y-3"
          >
            {figure.frames.map((board, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 押す順の姿は、並び順そのものが識別になる
              <Fragment key={index}>
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="flex w-7 flex-col items-center text-muted-foreground text-supporting"
                  >
                    {pressWord}
                    <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} />
                  </span>
                ) : null}
                <span aria-hidden="true" className="flex">
                  <HowToPlayFigure
                    example={createTakuzuExampleBoard(board)}
                    size="inherited"
                    currentCells={figure.frames[index - 1]?.pressedCells}
                  />
                </span>
              </Fragment>
            ))}
            <figcaption className="col-span-5 text-center text-supporting">
              <HowToPlayPhrases text={howToPress} />{" "}
              {/* 狭い幅でも「置き直し」の途中で折らず、矢印から回数までを1つにまとめて次の行へ送る。 */}
              <span className="inline-block">
                → 置き直し{" "}
                <span className="font-semibold text-body">
                  {figure.correctionCount}回
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </HowToPlayExamplePanel>
  );
}
