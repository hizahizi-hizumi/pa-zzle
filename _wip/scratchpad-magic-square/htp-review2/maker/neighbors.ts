// 「隣の数」の押し間違いの例外が、数の並びで隣り合う数ではなく、盤面の下に並んだ数（8列）で隣り合う札を指すことを確かめる。
const F = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/rev3/frontend/src/games/magic-square";
const S = await import(`${F}/session/session.ts`);
const { inputMagicSquareValue } = await import(`${F}/play/use-magic-square-play.ts`);
const E = await import(`${F}/ui/MagicSquareHowToPlayDialog/example-board.ts`);
// 採点の流れの図と同じ始まり: 2列目に 4 と 14、4行2列を選ぶ。
const start = S.selectMagicSquareSessionCell(E.createMagicSquareExampleSession({ region: { row: 3, column: 1, rowCount: 1, columnCount: 1 }, rows: [". +4 . .", ". . . .", ". +14 . .", ". . . ."] }), 13);
const place = (s: any, v: number) => inputMagicSquareValue(s, "value", v, 0).session;
for (const [a, b] of [[16, 15], [16, 8], [16, 7], [16, 17 - 1 - 0]] as const) {
  const s = place(place(start, a), b);
  console.log(`${a} -> ${b}: correction`, S.getMagicSquareSessionCorrectionCount(s));
}
// 数の並びで隣り合うが札が隣り合わない組: 合計に届く数で試す。2列目 4+14=18、空き2つ → 16 で届く。9 と 8 は札の8列で 8 は1行目の右端、9 は2行目の左端。
// 合計に届く 16 以上は無いので、別の始まり: 2列目に 4 と 14 と 7 → 25、9 で 34 に届く（空き無し→埋まる）。代わりに 1 つ空きを残して 9 で 27... 
const start2 = S.selectMagicSquareSessionCell(E.createMagicSquareExampleSession({ region: { row: 3, column: 1, rowCount: 1, columnCount: 1 }, rows: [". +4 . .", ". +12 . .", ". . . .", ". . . ."] }), 13);
// 2列目 4+12=16, 空き2つ。9 → 25 (届かない)。 18 は無い。届く数が無いので、行で試す: 4行目に 15 16 を置いて 3 を置くと 34 に届く…
const start3 = S.selectMagicSquareSessionCell(E.createMagicSquareExampleSession({ region: { row: 3, column: 0, rowCount: 1, columnCount: 4 }, rows: [". . . .", ". . . .", ". . . .", "+13 +12 . ."] }), 14);
// 4行目 13+12=25, 空き2つ。9 → 34 届く（色が変わる）。8 → 33 届かない。
for (const [a, b] of [[9, 8], [9, 10], [9, 1], [9, 2]] as const) {
  const s = place(place(start3, a), b);
  console.log(`row: ${a} -> ${b}: correction`, S.getMagicSquareSessionCorrectionCount(s));
}
