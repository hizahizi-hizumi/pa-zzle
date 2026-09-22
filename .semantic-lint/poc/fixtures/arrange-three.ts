describe("createUser", () => {
  test("ユーザーを作成できること", () => {
    const name = "Alice";
    const age = 20;
    const input = { name, age };

    const result = createUser(input);

    expect(result.name).toBe(name);
  });
});
