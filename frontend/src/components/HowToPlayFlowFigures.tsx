import { ArrowRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

/** 流れの数え方。図の下の流れの右に「→ 名前 値」と添える。 */
type HowToPlayFlowCount = {
  /** 数えるものの名前（「置き直し」「手戻り」など）。 */
  label: string;
  /** 数えた値（「1回」「1手」など）。 */
  value: string;
};

/** 操作の流れ1つ。 */
type HowToPlayFlowFigure<Frame> = {
  /** 操作の前後の姿を、左から順に並べるコマ。 */
  frames: readonly Frame[];
  /**
   * コマの間の矢印に添える操作の名前。`frames` より1つ少なく並べる。
   * 矢印の列を3文字ほどの幅に保ち、長い名前はその幅で2行に折り返す。`/` で区切れば、区切った所の間でだけ折り返す。
   */
  steps: readonly string[];
  /** 図の下に添える流れ。流れごとに違う言葉にする。`/` で区切った文節の間でだけ折り返す。 */
  caption: string;
  /** 流れの右に添える数え方。 */
  count: HowToPlayFlowCount;
};

type HowToPlayFlowFiguresProps<Frame> = {
  figures: readonly HowToPlayFlowFigure<Frame>[];
  /**
   * コマ1つを、押せない図で描く。押す所の手がかりや指のアイコンは付けない。
   * `previous` は1つ前のコマで、その間の操作で押した所を、本番で押した所と同じ見た目で示すときに使う（バイナリパズルの選んだマス、
   * 水のパズルの持ち上げた注ぐ元など）。最初のコマでは `undefined`。
   */
  renderFrame: (frame: Frame, previous: Frame | undefined) => ReactNode;
};

/**
 * 採点の数え方を、操作の流れで見せる押せない図。ルールの例と同じ面に、流れを縦に並べる。押す所の手がかりや指のアイコンは付けない。
 * コマの盤面の大きさは、ゲームが図を置く所で CSS 変数として決め、コマはそれを読む。
 * どの流れも、操作の前から後までの姿を左から順に並べ、間に操作の名前を添えた矢印を、盤面の高さの中央にそろえて置く。
 * 流れどうしの姿と矢印は同じ列にそろえ、最初の姿の左端を合わせる。
 * 図の下に、流れと、本番の数え方で数えた値を「→ 置き直し 1回」の形で添える。値は採点の項目名と同じ太字の本文にする。
 */
export function HowToPlayFlowFigures<Frame>({
  figures,
  renderFrame,
}: HowToPlayFlowFiguresProps<Frame>) {
  // 姿と矢印を交互に並べる列。いちばん長い流れの列の数にし、短い流れは左の列から詰める。
  const columnCount = Math.max(
    ...figures.map(({ frames }) => frames.length * 2 - 1),
  );
  // 矢印の列は名前の幅をそのまま取り、狭い面でも名前を1文字ずつに折らない。
  const columnTemplate = Array.from({ length: columnCount }, (_, column) =>
    column % 2 === 0 ? "auto" : "max-content",
  ).join(" ");
  const spanAllColumns = { gridColumn: `span ${columnCount}` };
  const captionColumns = { gridColumn: `1 / span ${columnCount}` };
  return (
    <HowToPlayExamplePanel arrangement="stacked">
      <div
        className="grid justify-center gap-x-1 gap-y-10"
        style={{ gridTemplateColumns: columnTemplate }}
      >
        {figures.map(({ frames, steps, caption, count }) => (
          <figure
            key={caption}
            className="grid grid-cols-subgrid items-center gap-y-3"
            style={spanAllColumns}
          >
            {frames.map((frame, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 操作の順の姿は、並び順そのものが識別になる
              <Fragment key={index}>
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="flex min-w-7 flex-col items-center text-muted-foreground text-supporting"
                  >
                    <span className="w-max max-w-[3.2em] text-center">
                      <HowToPlayPhrases text={steps[index - 1] ?? ""} />
                    </span>
                    <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} />
                  </span>
                ) : null}
                <span aria-hidden="true" className="flex">
                  {renderFrame(frame, frames[index - 1])}
                </span>
              </Fragment>
            ))}
            <figcaption
              className="text-center text-supporting"
              style={captionColumns}
            >
              <HowToPlayPhrases text={caption} />{" "}
              {/* 数え方は途中で折り返さず、狭い幅では流れの後ろで折り返す。 */}
              <span className="whitespace-nowrap">
                {`→ ${count.label} `}
                <span className="font-semibold text-body">{count.value}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </HowToPlayExamplePanel>
  );
}
