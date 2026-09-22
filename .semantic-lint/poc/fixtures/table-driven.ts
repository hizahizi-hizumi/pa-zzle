describe("parseNumber", () => {
  test("1を変換できること", () => {
    const result = parseNumber("1");

    expect(result).toBe(1);
  });

  test("2を変換できること", () => {
    const result = parseNumber("2");

    expect(result).toBe(2);
  });
});
