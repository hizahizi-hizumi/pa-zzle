import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import type { NanpureUnitKind } from "@/games/nanpure/puzzle/rules";
import { describeNanpureConflictKinds } from "@/games/nanpure/ui/NanpureHowToPlayDialog/conflict-reason";
import type { NanpureExampleVerdict } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";

type UnitVerdictCaptionProps = {
  verdict: NanpureExampleVerdict;
  /** 例が教えるまとまりのほかに、数字が重なったまとまりの種類。 */
  otherConflictKinds: readonly NanpureUnitKind[];
};

const shapeLabels = { allowed: "できる", disallowed: "できない" };

/**
 * 形のルールの例の判定。✕ とわけの色は共通の判定に任せ、重なりの色は盤面の印だけで見せる。
 * 例が教えるまとまりのほかでも数字が重なったときは、重なったまとまりをすべて判定の下に添える。
 */
export function UnitVerdictCaption({
  verdict,
  otherConflictKinds,
}: UnitVerdictCaptionProps) {
  return (
    <HowToPlayVerdict
      verdict={verdict}
      labels={shapeLabels}
      reason={describeNanpureConflictKinds(otherConflictKinds, { also: true })}
    />
  );
}
