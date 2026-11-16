import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import {
  getTsumeShogiExampleCaptionLineId,
  type TsumeShogiExampleCaptionLine,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample/example-caption";

type ExampleCaptionProps = {
  /** 今の姿の1行。`null` は何も見せず、行の場所だけを取る。 */
  line: TsumeShogiExampleCaptionLine | null;
  /** 出しうる行。言葉の層に重ね、どの行に替えても周りを動かさない。 */
  layers: readonly TsumeShogiExampleCaptionLine[];
};

function renderLine(line: TsumeShogiExampleCaptionLine) {
  switch (line.type) {
    case "legend":
      return (
        <HowToPlayMarkLegend
          labels={line.labels}
          shownMarks={line.shownMarks}
        />
      );
    case "verdict":
      return (
        <HowToPlayVerdict
          verdict={line.allowed ? "allowed" : "disallowed"}
          labels={line.labels}
          reason={line.reason ?? undefined}
          ruleReason={line.ruleReason ?? undefined}
        />
      );
    case "text":
      return <span className="whitespace-nowrap">{line.text}</span>;
  }
}

/**
 * 触れる例の下の1行。判定・凡例・起きたことを共通の言葉の層に重ねて入れ替え、どれも例の盤面の真下の中央に置く。
 * 今の行は今の姿（判定の ✓ / ✕・凡例の記号・わけ）で描き、ほかの行は場所を取るためだけに重ねる。
 */
export function ExampleCaption({ line, layers }: ExampleCaptionProps) {
  const shownId =
    line === null ? null : getTsumeShogiExampleCaptionLineId(line);
  const candidates =
    line === null ||
    layers.some((layer) => getTsumeShogiExampleCaptionLineId(layer) === shownId)
      ? layers
      : [...layers, line];
  return (
    <HowToPlayCaptionLayers
      layers={candidates.map((candidate) => {
        const id = getTsumeShogiExampleCaptionLineId(candidate);
        const current = id === shownId ? line : null;
        return {
          id,
          shown: current !== null,
          content: renderLine(current ?? candidate),
        };
      })}
    />
  );
}
