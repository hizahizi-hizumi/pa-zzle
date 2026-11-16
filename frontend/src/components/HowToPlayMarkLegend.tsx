import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import type { HowToPlayVerdictLabels } from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";

/** 盤面に出ている印の記号。凡例は、出ている記号だけを説明する。 */
export type HowToPlayShownMarks = { allowed: boolean; disallowed: boolean };

type HowToPlayMarkLegendProps = {
  /** 記号の意味。手のルールでは手の動詞で言う（✓ 通れる・✕ 通れない など）。 */
  labels: HowToPlayVerdictLabels;
  shownMarks: HowToPlayShownMarks;
};

/**
 * 盤面に付けた手ごとの ✓ / ✕ の印の凡例。記号と言葉の1行は判定と同じ部品で描き、✓・✕ の順に並べる。
 * 両方・✓ だけ・✕ だけの3つの並びを同じ場所に重ね、盤面に出ている記号の並びだけを見せて、残りを中央に寄せる。
 * 印が1つも無い間も、行の場所は取る。読み上げは、2つの言葉を「、」で区切って読む。
 */
export function HowToPlayMarkLegend({
  labels,
  shownMarks,
}: HowToPlayMarkLegendProps) {
  const allowed = (
    <HowToPlayVerdictLine mark={<HowToPlayVerdictMark verdict="allowed" />}>
      {labels.allowed}
    </HowToPlayVerdictLine>
  );
  const disallowed = (
    <HowToPlayVerdictLine mark={<HowToPlayVerdictMark verdict="disallowed" />}>
      {labels.disallowed}
    </HowToPlayVerdictLine>
  );
  return (
    <HowToPlayCaptionLayers
      layers={[
        {
          id: "both",
          shown: shownMarks.allowed && shownMarks.disallowed,
          content: (
            <span className="flex items-center gap-4">
              {allowed}
              <span className="sr-only">、</span>
              {disallowed}
            </span>
          ),
        },
        {
          id: "allowed",
          shown: shownMarks.allowed && !shownMarks.disallowed,
          content: allowed,
        },
        {
          id: "disallowed",
          shown: !shownMarks.allowed && shownMarks.disallowed,
          content: disallowed,
        },
      ]}
    />
  );
}
