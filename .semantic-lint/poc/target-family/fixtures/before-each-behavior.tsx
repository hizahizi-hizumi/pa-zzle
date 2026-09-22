describe("dialog", () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
  });

  test("閉じる操作を通知すること", () => {
    expect(onClose).toHaveBeenCalledOnce();
  });
});
