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
    test("ルールの例はどれも触れる例にし、対の例はできる形とできない形の判定で始めること", () => {
      const captions: string[] = [];
      const figures = within(openTab("ルール")).getAllByRole("figure", {
        name: (name) => {
          captions.push(name);
          return true;
        },
      });

      expect([figures.some(isInert), captions]).toEqual([
        false,
        [
          "",
          "できる",
          "できない・いちばん左が0",
          "合う",
          "合わない・十の位が合わない",
          "一の位が空いていて線が出ない",
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
