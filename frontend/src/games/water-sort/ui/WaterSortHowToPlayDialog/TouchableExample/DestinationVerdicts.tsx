import type { CSSProperties } from "react";

import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import {
  getBottleRowGap,
  getBottleRowWidth,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/bottle-size";

/**
 * 1本のボトルの真下に付ける答え。
 * - `allowed` / `disallowed`: 選んでいる間の、選んでいるボトルからそのボトルへ注げるか。`reason` は注げないわけの言葉。
 * - `poured`: 注いだ後の、試した手で注いだボトル。今の盤面の答えではなく、試した手の結果。
 */
export type DestinationAnswer =
  | { result: "allowed" }
  | { result: "disallowed"; reason: string | null }
  | { result: "poured" };

type DestinationVerdictsProps = {
  /** ボトルごとの答え。答えを付けないボトル（選んでいるボトル自身など）は `null`。 */
  answers: readonly (DestinationAnswer | null)[];
};

const answerWords = {
  allowed: "注げる",
  disallowed: "注げない",
  poured: "注げた",
} as const satisfies Record<DestinationAnswer["result"], string>;

const legendLabels = {
  allowed: answerWords.allowed,
  disallowed: answerWords.disallowed,
};

/** 印の真下に添える言葉。✕ には注げないわけ、注いだボトルの ✓ には試した手の結果。 */
function findNote(answer: DestinationAnswer | null): string | null {
  switch (answer?.result) {
    case "disallowed":
      return answer.reason;
    case "poured":
      return answerWords.poured;
    default:
      return null;
  }
}

/**
 * 各ボトルの真下に並べる答え（✓ / ✕）と、その下の言葉の段、さらにその下に1行で添える印の凡例（✓ 注げる　✕ 注げない）。
 * 答えは例の盤面と同じ幅と列でボトルにそろえ、例の判定の言葉と同じ形・大きさ・色にする。
 * ✕ のボトルには、押す前から注げないわけを、その ✕ の真下に添える。いちばん上が同じ色でも満杯のボトルは、見ただけでは注げそうに見えるため。
 * 「注げない」はボトル1本の幅に収まらないので、選んでいる間の答えの意味は、ボトルごとに書かず、凡例の行にまとめる。
 * 凡例は付けた答えの記号だけを説明し、盤面の真ん中に置く。選んだボトルで答えを付けるボトルが替わっても、凡例は動かさない。
 * 注いだ後は、注いだボトルの ✓ の真下に「注げた」と書く。ボトルの幅に収まる言葉なので、凡例の行は消す。
 * 言葉の段と凡例の行の高さは最初から取り、答えが1つも無いときも同じ高さの場所を取って、周りを動かさない。
 */
export function DestinationVerdicts({ answers }: DestinationVerdictsProps) {
  const columns: CSSProperties = {
    width: getBottleRowWidth(answers.length),
    gridTemplateColumns: `repeat(${answers.length}, minmax(0, 1fr))`,
    columnGap: getBottleRowGap(answers.length),
  };
  const shownMarks = {
    allowed: answers.some((answer) => answer?.result === "allowed"),
    disallowed: answers.some((answer) => answer?.result === "disallowed"),
  };
  return (
    <span className="grid gap-y-1" style={columns}>
      {answers.map((answer, bottleIndex) => {
        const position = bottleIndex + 1;
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
                  {`ボトル ${position}: ${answerWords[answer.result]}`}
                </span>
              </span>
            )}
            {/* わけはボトルの幅より長いことがあるので、列の幅を変えずに、列の中央から左右へはみ出して置く。 */}
            <span className="relative w-full">
              {note === null ? null : (
                <span
                  // 注げたことは印の読み上げで言い終えているので、同じ言葉を2度読ませない。
                  aria-hidden={answer?.result === "poured"}
                  className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <span className="sr-only">・</span>
                  {note}
                </span>
              )}
              {/* 読み上げで、ボトルごとの答えとわけを区切る。 */}
              {answer === null ? null : <span className="sr-only">。</span>}
            </span>
          </span>
        );
      })}
      {/* 凡例は盤面の幅より長いことがあるので、列の幅を変えずに、盤面の真ん中から左右へはみ出して置く。 */}
      {/* ボトルごとの答えを読み上げで言い終えているので、凡例は読み上げない。 */}
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
