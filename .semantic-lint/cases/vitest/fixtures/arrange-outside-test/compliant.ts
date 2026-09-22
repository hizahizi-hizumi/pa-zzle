describe("sum", () => {
  const values = [1, 2, 3];

  test("合計を返すこと", () => {
    const result = sum(values);

    expect(result).toBe(6);
  });
});
