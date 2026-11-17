import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import type { NanpureUnitKind } from "@/games/nanpure/puzzle/rules";
import { nanpureCellToneClassNames } from "@/games/nanpure/ui/board/nanpure-cell-tone";
import { describeNanpureConflictKinds } from "@/games/nanpure/ui/NanpureHowToPlayDialog/conflict-reason";

type GivenVerdictCaptionProps = {
  /** 選んだマス（選ぶ前は手がかりのマス）の数字を変えられるか。 */
  changeable: boolean;
  /** 触った後に、例の数字が重なった行・列・ブロックの種類。 */
  conflictKinds: readonly NanpureUnitKind[];
};

const changeLabels = { allowed: "変えられる", disallowed: "変えられない" };

/** 凡例に見せる数字。盤面の数字と同じ色で、最初からある数字と入れた数字を見分ける。 */
const legendDigit = 5;

/**
 * 最初からある数字のルールの例の判定（✓ 変えられる / ✕ 変えられない）と、その下の2つの数字の色の凡例。
 * 判定は、選んだマスの数字を変えられるかを言う。選ぶ前は、手がかりのマスを選んだときの答えを言う。
 * 入れた数字を変えて行・列・ブロックで重なったときは、変えられる判定のままでも、重なったまとまりを判定の下に添える。
 * 添える言葉は高さを取らずに判定の下に重なるので、凡例はその1行の分を空けた下に置き、出し入れで凡例を動かさない。
 */
export function GivenVerdictCaption({
  changeable,
  conflictKinds,
}: GivenVerdictCaptionProps) {
  return (
    <span className="flex w-full flex-col items-center">
      <HowToPlayVerdict
        verdict={changeable ? "allowed" : "disallowed"}
        labels={changeLabels}
        reason={describeNanpureConflictKinds(conflictKinds, { also: false })}
      />
      {/* 盤面のマスの読み上げ名が最初からある数字かを伝えるので、凡例は読み上げない。 */}
      <span
        aria-hidden="true"
        className="mt-[calc(1lh+--spacing(2))] flex gap-4 text-muted-foreground"
      >
        <HowToPlayVerdictLine
          mark={
            <span className={nanpureCellToneClassNames.clue}>
              {legendDigit}
            </span>
          }
        >
          最初からある数字
        </HowToPlayVerdictLine>
        <HowToPlayVerdictLine
          mark={
            <span className={nanpureCellToneClassNames.entered}>
              {legendDigit}
            </span>
          }
        >
          入れた数字
        </HowToPlayVerdictLine>
      </span>
    </span>
  );
}
