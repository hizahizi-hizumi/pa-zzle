describe("sum", () => {
  test("合計を返すこと", () => {
    const values = [1, 2, 3];

    const result = sum(values);

    expect(result).toBe(6);
  });
});
