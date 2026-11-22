import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { SCORE_ITEM_LABELS } from "@/games/play-vocabulary";
import { SHUTTLE_PARKING_SCORE_MAXIMUMS } from "@/games/shuttle-parking/score";
import { ShuttleParkingHowToPlayDialog } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog";

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "送迎パーキングの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

describe("ShuttleParkingHowToPlayDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    render(<ShuttleParkingHowToPlayDialog open onClose={onClose} />);
  });

  test("ルールの例を本番と同じ駐車場の部品で描くこと", () => {
    const panel = openTab("ルール");

    const lots = within(panel).getAllByRole("group", {
      name: "送迎パーキングの駐車場",
    });

    expect(lots.length).toBeGreaterThan(1);
  });

  test("採点のタブに、結果画面と同じ順で項目と満点を示すこと", () => {
    const panel = openTab("採点");

    const headings = within(panel)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(
      Object.entries(SHUTTLE_PARKING_SCORE_MAXIMUMS).map(
        ([item, maximum]) =>
          `${SCORE_ITEM_LABELS[item as keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS]} ${maximum}点`,
      ),
    );
  });

  test("閉じると通知すること", () => {
    fireEvent.click(
      within(getDialog()).getByRole("button", { name: "閉じる" }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
