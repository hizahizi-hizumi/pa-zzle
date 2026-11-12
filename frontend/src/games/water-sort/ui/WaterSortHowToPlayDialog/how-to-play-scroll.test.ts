import { onHowToPlayScroll } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/how-to-play-scroll";

describe("onHowToPlayScroll", () => {
  const listener = vi.fn();
  let scroller: HTMLDivElement;
  let neighbor: HTMLDivElement;
  let stop: () => void;

  beforeEach(() => {
    listener.mockClear();
    scroller = document.createElement("div");
    neighbor = document.createElement("div");
    const board = document.createElement("div");
    scroller.append(board);
    document.body.append(scroller, neighbor);
    stop = onHowToPlayScroll(board, listener);
  });

  afterEach(() => {
    stop();
    scroller.remove();
    neighbor.remove();
  });

  test("盤面を含む、中身を送る要素が送られると呼ぶこと", () => {
    scroller.dispatchEvent(new Event("scroll"));

    expect(listener).toHaveBeenCalledOnce();
  });

  test("盤面を含まない隣の要素が送られても呼ばないこと", () => {
    neighbor.dispatchEvent(new Event("scroll"));

    expect(listener).not.toHaveBeenCalled();
  });

  describe("止めた場合", () => {
    beforeEach(() => {
      stop();
    });

    test("盤面を含む要素が送られても呼ばないこと", () => {
      scroller.dispatchEvent(new Event("scroll"));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
