import type { NanpureCell } from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";

export type NanpureCellAccessibleNameInput = {
  row: number;
  column: number;
  value: NanpureCell;
  clue: boolean;
  notes: NanpureNotes[number];
  conflict: boolean;
  mistake: boolean;
};

/** マスの読み上げ名。盤面と遊び方の例で同じ名前にする。`row`・`column` は1始まりで読み上げる行と列。 */
export function getNanpureCellAccessibleName({
  row,
  column,
  value,
  clue,
  notes,
  conflict,
  mistake,
}: NanpureCellAccessibleNameInput): string {
  const prefix = `${row}行${column}列`;

  if (value !== null) {
    const source = clue ? "、初期ヒント" : "";
    const states = [mistake ? "誤り" : null, conflict ? "競合" : null]
      .filter((state) => state !== null)
      .join("、");
    return `${prefix}、${value}${source}${states ? `、${states}` : ""}`;
  }

  return notes.length > 0
    ? `${prefix}、空き、メモ ${notes.join("、")}`
    : `${prefix}、空き`;
}
