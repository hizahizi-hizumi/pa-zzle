import { _private } from "@/games/nanpure/ui/board/unit-completion-flash";

const { getUnitFlashOrders } = _private;

describe("getUnitFlashOrders", () => {
  describe("行と列が同時に完成した場合", () => {
    const units = [
      { kind: "row", index: 0 },
      { kind: "column", index: 4 },
    ] as const;

    test("2つのまとまりのマスをどちらも端から順に光らせ、重なるマスは早い方の順番にすること", () => {
      const orders = getUnitFlashOrders(units);

      expect(orders.size).toBe(17);
      expect(orders.get(0)).toBe(0);
      expect(orders.get(8)).toBe(8);
      expect(orders.get(4)).toBe(0);
      expect(orders.get(76)).toBe(8);
    });
  });
});
