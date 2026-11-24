import { createMagicSquareExampleSession } from "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/rev3/frontend/src/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import { getMagicSquareSessionCorrectionCount, inputMagicSquareSessionValue, selectMagicSquareSessionCell, restartMagicSquareSession, undoMagicSquareSession } from "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/rev3/frontend/src/games/magic-square/session/session";

const base = (rows: string[]) => createMagicSquareExampleSession({ region: { row: 0, column: 0, rowCount: 4, columnCount: 4 }, rows });
const put = (s: any, v: number) => inputMagicSquareSessionValue(s, "value", v, 0).session;

// Case A: same cell selected, place a number that does not change colour, then 盤面を戻す
let a = selectMagicSquareSessionCell(base(["14 4 . .", ". . . .", ". . . .", ". . . ."]), 2);
a = put(a, 5);
console.log("A before restart", getMagicSquareSessionCorrectionCount(a), "selected", a.selectedCellIndex);
a = restartMagicSquareSession(a);
console.log("A after restart (same cell still selected)", getMagicSquareSessionCorrectionCount(a), "selected", a.selectedCellIndex);

// Case B: second mistype in the same cell
let b = selectMagicSquareSessionCell(base(["14 4 5 .", ". . . .", ". . . .", ". . . ."]), 3);
for (const v of [12, 11, 7, 15]) { b = put(b, v); console.log("B after", v, "count", getMagicSquareSessionCorrectionCount(b)); }

// Case C: single mistype then neighbour
let c = selectMagicSquareSessionCell(base(["14 4 5 .", ". . . .", ". . . .", ". . . ."]), 3);
for (const v of [7, 15]) { c = put(c, v); console.log("C after", v, "count", getMagicSquareSessionCorrectionCount(c)); }
