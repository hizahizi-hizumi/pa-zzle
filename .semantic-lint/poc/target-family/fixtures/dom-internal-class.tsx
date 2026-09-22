test("保存状態を表示すること", () => {
  render(<SaveStatus saved />);
  const status = screen.getByRole("status");

  expect(status.classList.contains("is-saved")).toBe(true);
});
