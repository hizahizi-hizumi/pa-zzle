describe("InternalDiagnosticsDialog", () => {
  test("診断情報を表示して再現用JSONをコピーできること", async () => {
    fireEvent.click(screen.getByRole("button", { name: "再現用JSONをコピー" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith('{"game":"test"}');
  });

  test("閉じる操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Escapeキーで閉じる操作を通知すること", () => {
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
