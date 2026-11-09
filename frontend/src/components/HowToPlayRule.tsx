import type { ReactNode } from "react";

import {
  type HowToPlayExampleArrangement,
  HowToPlayExamplePanel,
} from "@/components/HowToPlayExamplePanel";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

type HowToPlayRuleProps = {
  /** 一文。`/` で区切った文節の間でだけ折り返す。 */
  text: string;
  /** 例を `HowToPlayExample` で、できる形、できない形の順に渡す。 */
  examples: ReactNode;
  arrangement?: HowToPlayExampleArrangement;
  /** 文の見出しの段。まとまりの見出しの下に置くときは 4 にする。 */
  headingLevel?: 3 | 4;
};

/**
 * 遊び方のルールや操作の例1つ。一文の下に、触れる例を背景差だけの面の中に並べる。
 * 一文がルールの見出しを兼ねるときは、本文の大きさの太字にし、帯の名前とまとまりの見出しより一段退かせる。
 * まとまりの見出しの下では、普通の太さの本文にする。
 */
export function HowToPlayRule({
  text,
  examples,
  arrangement = "side-by-side",
  headingLevel = 3,
}: HowToPlayRuleProps) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <section className="space-y-3">
      <Heading
        className={
          headingLevel === 3 ? "text-section-title" : "font-semibold text-body"
        }
      >
        <HowToPlayPhrases text={text} />
      </Heading>
      <HowToPlayExamplePanel arrangement={arrangement} resettable>
        {examples}
      </HowToPlayExamplePanel>
    </section>
  );
}
