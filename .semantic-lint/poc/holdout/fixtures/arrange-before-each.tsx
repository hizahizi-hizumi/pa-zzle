describe("InternalDiagnosticsDialog", () => {
  let onClose: () => void;
  let writeText: (text: string) => Promise<void>;

  beforeEach(() => {
    onClose = vi.fn();
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <InternalDiagnosticsDialog
        difficultyLabel="ふつう"
        seed="diagnostics-ui-seed"
        generatorVersion="1"
        generationConditions="条件表示"
        generationAttempt={7}
        buildRevision="abcdef1234567890"
        serializedSnapshot='{"game":"test"}'
        onClose={onClose}
      />,
    );
  });

  test("閉じる操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
