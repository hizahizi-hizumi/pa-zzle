describe("submitAnswer", () => {
  const emptyAnswer = "";

  test("回答が空の場合はエラーを返すこと", () => {
    const result = submitAnswer(emptyAnswer);

    expect(result.ok).toBe(false);
  });
});
