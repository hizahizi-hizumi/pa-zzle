test("保存状態を表示すること", () => {
  render(<SaveStatus saved />);

  expect(screen.getByText("保存しました")).toBeTruthy();
});
