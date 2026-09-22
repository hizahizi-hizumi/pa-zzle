test("81マスではない盤面を拒否すること", () => {
  const board = Array.from({ length: NANPURE_CELL_COUNT - 1 }, () => null);
  function act() {
    return assertNanpureBoard(board as NanpureBoard);
  }

  expect(act).toThrow("Nanpure board must contain 81 cells");
});
