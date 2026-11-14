import {
  _private,
  startShowcaseAtRest,
} from "@/components/GamePictogram/game-pictogram-motion";

const { SHOWCASE_ENTRY_REST_MS } = _private;

type FakeKeyframe = { computedOffset: number; [property: string]: unknown };

type FakeAnimation = {
  currentTime: number | null;
  effect: {
    getKeyframes: () => FakeKeyframe[];
    getTiming: () => { duration: number; delay: number };
  };
};

function fakeAnimation(
  keyframes: FakeKeyframe[],
  duration: number,
  delay = 0,
): FakeAnimation {
  return {
    currentTime: null,
    effect: {
      getKeyframes: () => keyframes,
      getTiming: () => ({ duration, delay }),
    },
  };
}

function containerWith(animations: FakeAnimation[]): Element {
  return { getAnimations: () => animations } as unknown as Element;
}

describe("startShowcaseAtRest", () => {
  describe("静止した姿の区間が入場の待ちより長い場合", () => {
    let move: FakeAnimation;

    beforeEach(() => {
      move = fakeAnimation(
        [
          { computedOffset: 0, transform: "none" },
          { computedOffset: 0.5, transform: "translateX(10px)" },
          { computedOffset: 1, transform: "translateX(10px)" },
        ],
        4000,
      );
    });

    test("周の終わりから入場の待ちだけ手前の時刻へ進めること", () => {
      startShowcaseAtRest(containerWith([move]));

      expect(move.currentTime).toBe(4000 - SHOWCASE_ENTRY_REST_MS);
    });
  });

  describe("静止した姿の区間が入場の待ちより短い場合", () => {
    let move: FakeAnimation;

    beforeEach(() => {
      move = fakeAnimation(
        [
          { computedOffset: 0, opacity: "0" },
          { computedOffset: 0.9, opacity: "1" },
          { computedOffset: 1, opacity: "1" },
        ],
        4000,
        100,
      );
    });

    test("遅延を足した静止した姿の区間の始めへ進めること", () => {
      startShowcaseAtRest(containerWith([move]));

      expect(move.currentTime).toBe(100 + 3600);
    });
  });

  describe("止まる時刻が違う動きが複数ある場合", () => {
    let early: FakeAnimation;
    let late: FakeAnimation;

    beforeEach(() => {
      early = fakeAnimation(
        [
          { computedOffset: 0, opacity: "0" },
          { computedOffset: 0.2, opacity: "1" },
          { computedOffset: 1, opacity: "1" },
        ],
        5000,
      );
      late = fakeAnimation(
        [
          { computedOffset: 0, opacity: "0" },
          { computedOffset: 0.95, opacity: "1" },
          { computedOffset: 1, opacity: "1" },
        ],
        5000,
      );
    });

    test("最も遅くまで動く対象に合わせてすべてを同じ時刻へ進めること", () => {
      startShowcaseAtRest(containerWith([early, late]));

      expect([early.currentTime, late.currentTime]).toEqual([4750, 4750]);
    });
  });

  describe("動きを取得できない環境の場合", () => {
    const container = {} as Element;

    test("何もせずに終わること", () => {
      const act = () => startShowcaseAtRest(container);

      expect(act).not.toThrow();
    });
  });
});
