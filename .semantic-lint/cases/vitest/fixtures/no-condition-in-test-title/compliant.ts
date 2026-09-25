describe("submitAnswer", () => {
  describe("回答が空の場合", () => {
    const emptyAnswer = "";

    test("回答時刻を記録せずにエラーを返すこと", () => {
      const result = submitAnswer(emptyAnswer);

      expect(result.ok).toBe(false);
    });
  });
});
