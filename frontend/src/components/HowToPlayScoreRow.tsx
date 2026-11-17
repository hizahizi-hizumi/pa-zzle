import type { ReactNode } from "react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

type HowToPlayScoreRowProps = {
  /** 数えるもの。プレイ画面の見出しや結果画面と同じ呼び名にする。`/` で区切った所の間でだけ折り返す。 */
  measure: string;
  /** 1回ごとに下がる点など、数えるものが点にどう効くか（「1回 −5点」など）。名前の行の右端に置く。 */
  deduction?: string;
  /** 数え方の補足。`/` で区切った所の間でだけ折り返す。 */
  text?: string;
  /** 補足の下に添える図。数えない操作などを、本番と同じ見え方で見せる。 */
  figure?: ReactNode;
};

/**
 * 採点の項目1つ。名前と点への効き方を太字の本文で1行に並べ、名前を見出しのように拾えるようにする。
 * 数え方の補足は、項目の名前より一段下げた説明の段にする。
 */
export function HowToPlayScoreRow({
  measure,
  deduction,
  text,
  figure,
}: HowToPlayScoreRowProps) {
  return (
    <li>
      <p className="flex items-baseline justify-between gap-x-4 font-semibold text-body">
        <span>
          <HowToPlayPhrases text={measure} />
        </span>
        {deduction ? (
          // 読み上げで、名前と点を続けて読ませないための空白。
          <>
            {" "}
            <span className="whitespace-nowrap tabular-nums">{deduction}</span>
          </>
        ) : null}
      </p>
      {text ? (
        <p className="mt-1 text-supporting">
          <HowToPlayPhrases text={text} />
        </p>
      ) : null}
      {figure ? <div className="mt-3">{figure}</div> : null}
    </li>
  );
}
