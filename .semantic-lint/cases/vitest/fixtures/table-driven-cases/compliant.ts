describe("parseNumber", () => {
  const cases = [
    ["1", 1],
    ["2", 2],
  ] as const;

  test.each(cases)("文字列を数値へ変換できること: %s", (input, expected) => {
    const result = parseNumber(input);

    expect(result).toBe(expected);
  });
});
