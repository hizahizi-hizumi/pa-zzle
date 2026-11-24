const S = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/rev3/frontend/src/games/magic-square/session/session.ts";
const s = await import(S);
// 1行目 14 4 5 . の盤面: 置いた数 X を置いて確定させ、置き換えてから元の数に戻す
const givens = { size: 4, cells: [14, 4, null, null, null, null, null, null, null, null, null, null, null, null, null, null] };
let x = s.createMagicSquareSession({ givens }, 0);
const step = (label: string) => console.log(label.padEnd(34), "置き直し", s.getMagicSquareSessionCorrectionCount(x), "| 1行3列", x.puzzleState.cells[2]);
x = s.selectMagicSquareSessionCell(x, 2); x = s.inputMagicSquareSessionValue(x, "value", 9, 0).session; step("1行3列に9を置く");
x = s.selectMagicSquareSessionCell(x, 5); step("ほかのマス(2行2列)を選ぶ");
x = s.selectMagicSquareSessionCell(x, 2); x = s.inputMagicSquareSessionValue(x, "value", 7, 0).session; step("1行3列を選び直して7に置き換える");
x = s.inputMagicSquareSessionValue(x, "value", 9, 0).session; step("すぐ9に戻す");
