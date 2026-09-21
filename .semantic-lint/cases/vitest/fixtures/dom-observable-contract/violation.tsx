test("保存状態を表示すること", () => {
  const { container } = render(<SaveStatus saved />);
  const status = container.querySelector("[data-state='saved']");

  expect(status).toHaveAttribute("data-state", "saved");
});
