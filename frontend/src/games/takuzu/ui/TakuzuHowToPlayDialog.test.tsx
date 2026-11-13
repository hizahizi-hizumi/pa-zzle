import { render, screen, within } from "@testing-library/react";

import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";

const onClose = vi.fn();

describe("TakuzuHowToPlayDialog", () => {
  test("標準の遊び方は盤面と同じマトリクスの数字と警告で示すこと", () => {
    render(<TakuzuHowToPlayDialog open onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(
      within(dialog).getByText("すべてのマスを0か1で埋める。"),
    ).not.toBeNull();
    expect(dialog.querySelectorAll(".takuzu-howto-figure")).toHaveLength(9);
    expect(
      dialog.querySelectorAll(".takuzu-howto-digit").length,
    ).toBeGreaterThan(0);
    expect(
      dialog.querySelectorAll(".takuzu-howto-cell[data-run-warning]"),
    ).toHaveLength(3);
  });
});
