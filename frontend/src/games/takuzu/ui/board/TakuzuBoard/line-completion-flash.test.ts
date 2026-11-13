import { _private } from "@/games/takuzu/ui/board/TakuzuBoard/line-completion-flash";

const { getLineFlashOrders } = _private;

describe("getLineFlashOrders", () => {
  describe("行と列が同時に埋まった場合", () => {
    const lines = [
      { axis: "row", index: 1 },
      { axis: "column", index: 2 },
    ] as const;

    test("どちらも端から順に光らせ、重なるマスは早い方の順番にすること", () => {
      const orders = getLineFlashOrders(4, lines);

      expect(orders.size).toBe(7);
      expect(orders.get(4)).toBe(0);
      expect(orders.get(7)).toBe(3);
      expect(orders.get(2)).toBe(0);
      expect(orders.get(6)).toBe(1);
      expect(orders.get(14)).toBe(3);
    });
  });
});
