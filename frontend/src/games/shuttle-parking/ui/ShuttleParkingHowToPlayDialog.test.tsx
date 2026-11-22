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
import { STUCK_NOTICE_LABEL } from "@/games/shuttle-parking/ui/ShuttleParkingStuckNotice";

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
  const onOpenTutorial = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onOpenTutorial.mockClear();
    render(
      <ShuttleParkingHowToPlayDialog
        open
        onClose={onClose}
        onOpenTutorial={onOpenTutorial}
      />,
    );
  });

  test("ゴールの盤面を本番の部品で描き、その下からチュートリアルを始められること", () => {
    const goal = within(getDialog()).getByRole("img", {
      name: "ゴールの盤面",
    });

    fireEvent.click(
      within(getDialog()).getByRole("button", {
        name: "チュートリアルで遊んで覚える",
      }),
    );

    expect(
      within(goal).getByRole("group", { name: "送迎パーキングの駐車場" }),
    ).toBeTruthy();
    expect(onOpenTutorial).toHaveBeenCalledOnce();
  });

  test("出口のルールの例で、前の空いた車は出られ、前を塞がれた車は出られないと示すこと", () => {
    const panel = openTab("ルール");

    expect(within(panel).getAllByText("出られる").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("前に車がある").length).toBeGreaterThan(
      0,
    );
  });

  test("前の空いた例の車を押すと、出られたと言い直すこと", () => {
    const panel = openTab("ルール");
    const [firstLot] = within(panel).getAllByRole("group", {
      name: "送迎パーキングの駐車場",
    });
    const car = firstLot?.querySelector('button[data-car-id="0"]');

    fireEvent.click(car as HTMLElement);

    expect(within(panel).getByText("出られた")).toBeTruthy();
  });

  test("操作のタブに、詰みの知らせを押せない図で載せること", () => {
    const panel = openTab("操作");

    expect(
      within(panel).getByRole("heading", { name: STUCK_NOTICE_LABEL }),
    ).toBeTruthy();
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
