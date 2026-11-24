// 置き直しの数え方を本番の session で確かめる。
const F = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/rev3/frontend/src/games/magic-square";
const S = await import(`${F}/session/session.ts`);
const { inputMagicSquareValue } = await import(`${F}/play/use-magic-square-play.ts`);

// 4x4 ゴールの答えの givens を使う。
const givens = { size: 4, cells: [16, null, null, 13, 5, null, 11, 8, 9, null, null, 12, null, 15, 14, null] };
// 答え（例）: 16 2 3 13 / 5 10 11 8 / 9 6 7 12 / 4 15 14 1
let s = S.createMagicSquareSession({ givens }, 0);
const place = (ss: any, v: number) => inputMagicSquareValue(ss, "value", v, 0).session;
const sel = (ss: any, c: number) => S.selectMagicSquareSessionCell(ss, c);
const count = (ss: any) => S.getMagicSquareSessionCorrectionCount(ss);

// 1. 列の色を変えない数を置いてすぐ待った
let a = place(sel(s, 1), 9); // 1行2列: 16 9 . 13 → 38 overreached? 16+9+13=38 >=34 → overreached: color changes!
console.log("row1 after 9:", a.puzzleState.cells.slice(0,4));
// choose a cell whose lines are not affected: 3行2列 (index 9): row3 9 . . 12 = 21; col2: . . . 15 = 15; diagonals? (2,1) is on the anti-diagonal (0,3),(1,2),(2,1),(3,0): 13+11+?+.
let b = place(sel(s, 10), 2); // 3行3列 index 10: row3 9 . 2 12 = 23; col3 . 11 2 14 = 27; main diag 16 . 2 . = 18 → no color change
console.log("after place 2 at (3,3):", count(b));
const bu = S.undoMagicSquareSession(b);
console.log("place 2 (no color change) then 待った immediately:", count(bu), "cell:", bu.puzzleState.cells[10]);
const br = S.restartMagicSquareSession(b);
console.log("place 2 (no color change) then 盤面を戻す immediately:", count(br));
const bx = place(b, 2);
console.log("place 2 then 外す immediately:", count(bx));
// 色を変える数を置いてすぐ待った
let c = place(sel(s, 10), 7); // row3: 9 . 7 12 = 28; col3: . 11 7 14 = 32; diag 16 . 7 . = 23 → no change. try bigger
let d = place(sel(s, 10), 13); // 13 used (given). try 10: row3 9+10+12 = 31, col3 11+10+14 = 35 → overreached (color change)
d = place(sel(s, 10), 10);
console.log("place 10 at (3,3) changes color? sum col3 =", d.puzzleState.cells[2], d.puzzleState.cells[6], d.puzzleState.cells[10], d.puzzleState.cells[14]);
console.log("place 10 then 待った:", count(S.undoMagicSquareSession(d)));
console.log("place 10 then 外す:", count(place(d, 10)));
