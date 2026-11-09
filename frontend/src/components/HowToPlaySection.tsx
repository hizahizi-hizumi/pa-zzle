import type { ReactNode } from "react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import {
  type HowToPlayAvailability,
  howToPlayAvailabilityClassNames,
} from "@/components/how-to-play-availability";
import { cn } from "@/lib/utils";

type HowToPlaySectionProps = {
  /** ルール・操作・数え方など、まとまりの短い見出し。 */
  title: string;
  /** 見出しの右端に添える値。採点の満点など。 */
  value?: string;
  availability?: HowToPlayAvailability;
  /** 見出しの下に置く、まとまり全体の一文。`/` で区切った所の間でだけ折り返す。 */
  lead?: string;
  /** まとまりの項目を1つずつ並べる `li` 群。 */
  children?: ReactNode;
};

/**
 * 遊び方の項目を、迷ったときに目で探せるよう、短い見出しを付けたまとまりで並べる。
 * 見出しの下に線を引き、まとまりの始まりを、太さだけに頼らず見分けられるようにする。
 * まとまり全体の一文は、太字を見出しと項目名の2段に留めるため、普通の太さにする。
 * まとまりの中の項目の間は、まとまりどうしの間（遊び方の層が取る）より詰め、親子を余白で読めるようにする。
 */
export function HowToPlaySection({
  title,
  value,
  availability = "always",
  lead,
  children,
}: HowToPlaySectionProps) {
  return (
    <section
      className={cn("space-y-4", howToPlayAvailabilityClassNames[availability])}
    >
      <h3 className="flex items-baseline justify-between gap-x-4 border-b pb-2 text-section-title">
        <span>
          <HowToPlayPhrases text={title} />
        </span>
        {value ? (
          // 読み上げと見出しの名前で、名前と値をつなげて読ませないための空白。
          <>
            {" "}
            <span className="tabular-nums">{value}</span>
          </>
        ) : null}
      </h3>
      {lead ? (
        <p className="text-body">
          <HowToPlayPhrases text={lead} />
        </p>
      ) : null}
      {children ? <ol className="space-y-4">{children}</ol> : null}
    </section>
  );
}
