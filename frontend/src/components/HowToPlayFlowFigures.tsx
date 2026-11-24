import { ArrowRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

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
   * 名前は全角の文字で書き、折り返さずに1行で描き、`/` で区切れば、区切った所で行を分ける。
   * どの矢印の列も、すべての名前のいちばん長い行の幅を取る。
   */
  steps: readonly string[];
  /** 図の下に添える流れ。流れごとに違う言葉にする。`/` で区切った所の間でだけ折り返す。 */
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
  /**
   * 矢印の中央を置く、コマの下端からの高さ（CSS の長さ）。コマの下に盤面の外の帯（合計など）があり、操作したマスがコマの高さの
   * 中央から離れる図で、矢印を操作したマスの高さにそろえるときに渡す。渡さなければ、名前と矢印をコマの高さの中央に置く。
   */
  arrowCenterFromFrameBottom?: string;
};

/**
 * 採点の数え方を、操作の流れで見せる押せない図。触れる例の地の面（`HowToPlayExamplePanel`）と見分けられるよう、地を敷かずに
 * 縁の線で囲んだ面に、流れを縦に並べる。面の大きさと内側の幅は触れる例の面と同じにし、縁の線の幅だけ余白を狭める。
 * 押す所の手がかりや指のアイコンは付けない。
 * コマの盤面の大きさは、ゲームが図を置く所で CSS 変数として決め、コマはそれを読む。
 * どの流れも、操作の前から後までの姿を左から順に並べ、間に操作の名前を添えた矢印を、盤面の高さの中央（または、ゲームが渡した
 * 操作したマスの高さ）にそろえて置く。
 * 流れどうしの姿と矢印は同じ列にそろえ、最初の姿の左端を合わせる。
 * 矢印の列は、どの列もすべての名前のいちばん長い行の幅にそろえ、姿が流れの中でも流れどうしでも等しい間隔で並ぶようにする。
 * 名前の行の数も、いちばん多い名前に合わせ、どの矢印も同じ高さに置く。名前と姿の間は 8px 空ける。
 * 図の下に、流れと、本番の数え方で数えた値を「→ 置き直し 1回」の形で添える。値は採点の項目名と同じ太字の本文にする。
 * 流れの言葉は図の左端にそろえて左寄せにし、数え方は図の右端にそろえた2列にして、どの流れでも行の頭と値を縦に見比べられるようにする。
 */
/** 矢印のアイコンの高さ（`size-5`）。矢印の中央を指定の高さに置くとき、列の下端を矢印の半分だけ下げる。 */
const ARROW_SIZE = "1.25rem";

export function HowToPlayFlowFigures<Frame>({
  figures,
  renderFrame,
  arrowCenterFromFrameBottom,
}: HowToPlayFlowFiguresProps<Frame>) {
  // 姿と矢印を交互に並べる列。いちばん長い流れの列の数にし、短い流れは左の列から詰める。
  const columnCount = Math.max(
    ...figures.map(({ frames }) => frames.length * 2 - 1),
  );
  // 矢印の列は名前の幅をそのまま取り、狭い面でも名前を1文字ずつに折らない。
  const columnTemplate = Array.from({ length: columnCount }, (_, column) =>
    column % 2 === 0 ? "auto" : "max-content",
  ).join(" ");
  // 名前はどれも全角の文字で書くので、字数を文字の大きさの倍数にした幅に、どの名前も収まる。
  const stepLines = figures.flatMap(({ steps }) =>
    steps.map((step) => step.split("/")),
  );
  const stepNameBox = {
    minWidth: `${Math.max(...stepLines.flat().map((line) => [...line].length))}em`,
    minHeight: `${Math.max(...stepLines.map((lines) => lines.length))}lh`,
  };
  const stepPlacement =
    arrowCenterFromFrameBottom === undefined
      ? undefined
      : {
          alignSelf: "end",
          marginBottom: `calc(${arrowCenterFromFrameBottom} - ${ARROW_SIZE} / 2)`,
        };
  const spanAllColumns = { gridColumn: `span ${columnCount}` };
  const captionColumns = { gridColumn: `1 / span ${columnCount}` };
  return (
    <div className="rounded-lg border-(length:--border-width-normal) px-[calc(--spacing(4)-var(--border-width-normal))] py-[calc(--spacing(8)-var(--border-width-normal))]">
      {/* コマの大きさを面の内側の幅に合わせて決められるよう、余白の内側をコンテナにする。 */}
      <div className="@container">
        <div
          className="grid justify-center gap-x-2 gap-y-10"
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
                      style={stepPlacement}
                    >
                      <span
                        className="flex flex-col items-center justify-end"
                        style={stepNameBox}
                      >
                        {(steps[index - 1] ?? "").split("/").map((line) => (
                          <span key={line} className="block whitespace-nowrap">
                            {line}
                          </span>
                        ))}
                      </span>
                      <ArrowRight
                        className="size-5 shrink-0"
                        strokeWidth={2.5}
                      />
                    </span>
                  ) : null}
                  <span aria-hidden="true" className="flex">
                    {renderFrame(frame, frames[index - 1])}
                  </span>
                </Fragment>
              ))}
              {/* 流れは図の左端に、数え方は図の右端にそろえた2列にする。数え方は途中で折り返さず、流れだけを折り返す。 */}
              {/* 言葉で列の幅を広げないよう、幅を取らずに図の幅いっぱいへ広げ、図の幅の中で折り返す。 */}
              <figcaption
                className="grid w-0 min-w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-supporting"
                style={captionColumns}
              >
                <span>
                  <HowToPlayPhrases text={caption} />
                </span>
                {/* 読み上げと文字の取り出しで、流れと数え方を続けて読ませないための空白。格子の中では場所を取らない。 */}{" "}
                <span className="whitespace-nowrap">
                  {`→ ${count.label} `}
                  <span className="font-semibold text-body">{count.value}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
