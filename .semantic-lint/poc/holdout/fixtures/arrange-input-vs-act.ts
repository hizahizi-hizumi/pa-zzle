test("セル番号から行・列・ブロックを算出できること", () => {
  const cellIndex = 50;

  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);

  expect({ row, column, block }).toEqual({ row: 5, column: 5, block: 4 });
});
