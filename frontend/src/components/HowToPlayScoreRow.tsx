import type { ReactNode } from "react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

type HowToPlayScoreRowProps = {
  /** 数えるもの。プレイ画面の見出しや結果画面と同じ呼び名にする。`/` で区切った所の間でだけ折り返す。 */
  measure: string;
  /** 1回ごとに下がる点など、数えるものが点にどう効くか（「1回 −5点」など）。名前の行の右端に置く。 */
  deduction?: string;
  /** 何を1回と数えるかの文。`/` で区切った所の間でだけ折り返す。 */
  text?: string;
  /** 文の下に添える図。数えない操作などを、本番と同じ見え方で見せる。 */
  figure?: ReactNode;
};

/**
 * 採点の項目1つ。名前と点への効き方を太字の本文で1行に並べ、名前を見出しのように拾えるようにする。
 * 何を数えるかの文は、項目の見出しの下の一文と同じ普通の太さの本文にし、数え方を見出しの一文より小さく組まない。
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
        <p className="mt-1 text-body">
          <HowToPlayPhrases text={text} avoidShortLastLine />
        </p>
      ) : null}
      {figure ? <div className="mt-3">{figure}</div> : null}
    </li>
  );
}
