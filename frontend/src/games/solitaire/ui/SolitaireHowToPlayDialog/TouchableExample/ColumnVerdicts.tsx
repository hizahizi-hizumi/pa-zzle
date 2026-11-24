import type { CSSProperties } from "react";

import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";

/**
 * 1つの列の真下に付ける答え。
 * - `allowed` / `disallowed`: 選んでいる間の、選んでいる札をその列へ置けるか。`reason` は置けないわけの言葉。
 * - `placed`: 置いた後の、試した手で置いた列。今の盤面の答えではなく、試した手の結果。
 */
export type ColumnAnswer =
  | { result: "allowed" }
  | { result: "disallowed"; reason: string | null }
  | { result: "placed" };

type ColumnVerdictsProps = {
  /** 列ごとの答え。答えを付けない列（選んでいる列自身など）は `null`。 */
  answers: readonly (ColumnAnswer | null)[];
  /** 列の幅と列の間（px）。盤面の列にそろえる。 */
  cardWidth: number;
  columnGap: number;
};

const answerWords = {
  allowed: "置ける",
  disallowed: "置けない",
  placed: "置けた",
} as const satisfies Record<ColumnAnswer["result"], string>;

const legendLabels = {
  allowed: answerWords.allowed,
  disallowed: answerWords.disallowed,
};

/** 印の真下に添える言葉。✕ には置けないわけ、置いた列の ✓ には試した手の結果。 */
function findNote(answer: ColumnAnswer | null): string | null {
  switch (answer?.result) {
    case "disallowed":
      return answer.reason;
    case "placed":
      return answerWords.placed;
    default:
      return null;
  }
}

/**
 * 各列の真下に並べる答え（✓ / ✕）と、その下の言葉の段、さらにその下に1行で添える印の凡例（✓ 置ける　✕ 置けない）。
 * 答えは盤面の列と同じ幅と間で列にそろえる。✕ の列には、押す前から置けないわけを、その ✕ の真下に添える。
 * 数が合っていても色が同じ札のように、見ただけでは置けそうに見える列があるため。
 * 「置けない」は札1枚の幅に収まらないので、答えの意味は列ごとに書かず、凡例の行にまとめる。
 * 置いた後は、置いた列の ✓ の真下に「置けた」と書き、凡例の行は消す。
 * 言葉の段と凡例の行の高さは最初から取り、答えが1つも無いときも同じ高さの場所を取って、周りを動かさない。
 */
export function ColumnVerdicts({
  answers,
  cardWidth,
  columnGap,
}: ColumnVerdictsProps) {
  const columns: CSSProperties = {
    gridTemplateColumns: `repeat(${answers.length}, ${cardWidth}px)`,
    columnGap,
  };
  const shownMarks = {
    allowed: answers.some((answer) => answer?.result === "allowed"),
    disallowed: answers.some((answer) => answer?.result === "disallowed"),
  };
  return (
    <span className="grid gap-y-1" style={columns}>
      {answers.map((answer, index) => {
        const position = index + 1;
        const note = findNote(answer);
        return (
          <span
            key={position}
            className="row-start-1 grid grid-rows-[1rem_1lh] justify-items-center gap-1"
          >
            {answer === null ? (
              <span />
            ) : (
              <span className="flex">
                <HowToPlayVerdictMark
                  verdict={
                    answer.result === "disallowed" ? "disallowed" : "allowed"
                  }
                />
                <span className="sr-only">
                  {`列${position}: ${answerWords[answer.result]}`}
                </span>
              </span>
            )}
            {/* わけは札の幅より長いことがあるので、列の幅を変えずに、列の中央から左右へはみ出して置く。 */}
            <span className="relative w-full">
              {note === null ? null : (
                <span
                  // 置けたことは印の読み上げで言い終えているので、同じ言葉を2度読ませない。
                  aria-hidden={answer?.result === "placed"}
                  className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <span className="sr-only">・</span>
                  {note}
                </span>
              )}
              {/* 読み上げで、列ごとの答えとわけを区切る。 */}
              {answer === null ? null : <span className="sr-only">。</span>}
            </span>
          </span>
        );
      })}
      {/* 凡例は盤面の幅より長いことがあるので、列の幅を変えずに、盤面の真ん中から左右へはみ出して置く。 */}
      {/* 列ごとの答えを読み上げで言い終えているので、凡例は読み上げない。 */}
      <span
        aria-hidden="true"
        className="relative col-span-full row-start-2 h-lh"
      >
        <span className="absolute top-0 left-1/2 flex -translate-x-1/2 whitespace-nowrap">
          <HowToPlayMarkLegend labels={legendLabels} shownMarks={shownMarks} />
        </span>
      </span>
    </span>
  );
}
