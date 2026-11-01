import type { NonogramLine } from "@/games/nonogram/puzzle/board";
import type { NonogramClue as NonogramClueValue } from "@/games/nonogram/puzzle/clue";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramClueProps = {
  line: NonogramLine;
  clue: NonogramClueValue;
  /** 塗りがこのヒントにちょうど合っている。 */
  matched: boolean;
  /** 押している・キーボードで選んでいるマスの行・列。 */
  active: boolean;
};

const axisNames = { row: "行", column: "列" } as const;

/** 行ヒントは盤面の左に右寄せで横へ、列ヒントは盤面の上に下寄せで縦へ数字を並べる。 */
const axisClassNames = {
  row: "flex-row items-center justify-end gap-[calc(var(--nonogram-cell)*0.18)] pr-[calc(var(--nonogram-cell)*0.22)]",
  column:
    "flex-col items-center justify-end pb-[calc(var(--nonogram-cell)*0.12)]",
} as const;

const numberClassNames = {
  row: "min-w-[calc(var(--nonogram-cell)*0.42)] text-center",
  column:
    "h-[calc(var(--nonogram-cell)*0.6)] leading-[calc(var(--nonogram-cell)*0.6)]",
} as const;

/** 黒の無い行・列のヒントは `0` と示す。 */
function listClueNumbers(clue: NonogramClueValue): readonly number[] {
  return clue.length === 0 ? [0] : clue;
}

export function NonogramClue({
  line,
  clue,
  matched,
  active,
}: NonogramClueProps) {
  const numbers = listClueNumbers(clue);

  return (
    <div
      role="note"
      aria-current={active || undefined}
      aria-label={`${line.index + 1}${axisNames[line.axis]}目のヒント ${numbers.join(" ")}${matched ? " 一致" : ""}`}
      className={cn(
        "flex min-h-0 min-w-0 font-sans font-semibold tabular-nums text-[length:min(calc(var(--nonogram-cell)*0.5),1.5rem)]",
        axisClassNames[line.axis],
        matched
          ? nonogramToneClassNames.matchedClue
          : nonogramToneClassNames.clue,
        active && nonogramToneClassNames.activeLine,
      )}
    >
      {numbers.map((length, blockIndex) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ヒントの数字の並びは問題で決まり、変わらない
          key={blockIndex}
          aria-hidden="true"
          className={numberClassNames[line.axis]}
        >
          {length}
        </span>
      ))}
    </div>
  );
}
