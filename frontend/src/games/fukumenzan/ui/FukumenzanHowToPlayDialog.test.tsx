import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { FukumenzanHowToPlayDialog } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

afterEach(cleanup);

function openTab(name: string): HTMLElement {
  const dialog = screen.getByRole("dialog", { name: "覆面算の遊び方" });
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(dialog).getByRole("tabpanel", { name });
}

function isInert(element: Element): boolean {
  return element.closest("[inert]") !== null;
}

describe("FukumenzanHowToPlayDialog", () => {
  beforeEach(() => {
    render(<FukumenzanHowToPlayDialog open onClose={vi.fn()} />);
  });

  describe("ルールのタブの場合", () => {
    test("できない形の例を、押せない図にして、できない・合わないと添えること", () => {
      const panel = openTab("ルール");
      const figures = [
        "D に 0 を入れて DDX の先頭が 0 になった式",
        "R に 7 を入れて十の位が合わない式",
      ].map((name) => within(panel).getByRole("img", { name }));

      expect([
        figures.every(isInert),
        figures.map((figure) => figure.closest("figure")?.textContent),
      ]).toEqual([
        true,
        [
          expect.stringContaining("できない"),
          expect.stringContaining("合わない"),
        ],
      ]);
    });
  });

  describe("操作のタブの場合", () => {
    test("× の数の図は押せず、U を選んだ姿で、× の付いていない札の数を U の右上に出すこと", () => {
      const figure = within(openTab("操作")).getByRole("img", {
        name: /^D に 8 を入れ U を選んで/,
      });
      const crossedCards = within(figure)
        .getAllByRole("button")
        .filter((button) =>
          button.getAttribute("aria-label")?.endsWith("（×）"),
        );

      expect([
        isInert(figure),
        crossedCards.length,
        within(figure).getAllByRole("button", { name: "U（候補 3）" }).length,
      ]).toEqual([true, 7, 2]);
    });

    test("待ったのボタンの図は押せないこと", () => {
      const undo = within(openTab("操作")).getByRole("button", {
        name: PLAY_OPERATION_LABELS.undo,
        hidden: true,
      });

      expect(isInert(undo)).toBe(true);
    });
  });
});
