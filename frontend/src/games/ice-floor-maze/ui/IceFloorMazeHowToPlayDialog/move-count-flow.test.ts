import { moveCountFlows } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/move-count-flow";

describe("moveCountFlows", () => {
  describe("滑らせてから待ったで取り消す流れ", () => {
    const flow = moveCountFlows.undo;

    test("滑ったコマに跡を描き、待った後は始まりと同じ姿に戻り、取り消した手も手数に残すこと", () => {
      const [start, slid, undone] = flow.frames;

      expect(slid?.trail).toEqual({ direction: "left", from: 2 });
      expect(slid?.state.position).toBe(0);
      expect(undone?.state).toEqual(start?.state);
      expect(flow.moveCount).toBe(1);
    });
  });

  describe("1マスも動けない向きを選ぶ流れ", () => {
    const flow = moveCountFlows.blocked;

    test("盤面を変えず、跡を描かず、手数に数えないこと", () => {
      const [start, tried] = flow.frames;

      expect(tried?.state).toEqual(start?.state);
      expect(tried?.trail).toBeNull();
      expect(flow.moveCount).toBe(0);
    });
  });
});
