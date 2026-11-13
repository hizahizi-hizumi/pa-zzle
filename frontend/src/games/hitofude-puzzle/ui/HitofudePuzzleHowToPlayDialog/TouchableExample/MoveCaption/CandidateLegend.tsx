import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { CandidateMark } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/CandidateMark";

/** 凡例に並べる記号。盤面にある印の記号だけにする。 */
export type CandidateLegendMarks = "both" | "allowed" | "disallowed";

type CandidateLegendProps = {
  marks: CandidateLegendMarks;
};

/**
 * 盤面の手ごとの印と同じ形で、✓ と ✕ の意味を1行で言う凡例。記号と言葉の1行は判定と同じ部品で描く。
 * 1つだけのときは、その1行を盤面の中央に置く。2つのときは、重ねて入れ替えるほかの言葉の場所の幅いっぱいに両端へ分けて置き、
 * まとまりの中央を盤面の中央にそろえ、いちばん長い言葉と入れ替えても頭がそろうようにする。
 */
export function CandidateLegend({ marks }: CandidateLegendProps) {
  const allowed = (
    <HowToPlayVerdictLine mark={<CandidateMark allowed size="legend" />}>
      通れる
    </HowToPlayVerdictLine>
  );
  const disallowed = (
    <HowToPlayVerdictLine
      mark={<CandidateMark allowed={false} size="legend" />}
    >
      通れない
    </HowToPlayVerdictLine>
  );
  if (marks === "allowed") {
    return allowed;
  }
  if (marks === "disallowed") {
    return disallowed;
  }
  return (
    <span className="flex w-full items-center justify-between gap-4">
      {allowed}
      {/* 読み上げで、2つの言葉を続けて読ませないための区切り。 */}
      <span className="sr-only">、</span>
      {disallowed}
    </span>
  );
}
