import {
  countZukanStampSlots,
  findZukanFollowScrollTop,
  findZukanRevealScrollTop,
  getZukanStampSlot,
  groupZukanStampSlots,
  planZukanStamps,
  playZukanStamp,
  type ZukanStampParts,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";

describe("getZukanStampSlot", () => {
  const cases = [
    [0, 0],
    [11, 11],
    [12, 12],
    [40, 12],
  ] as const;

  test.each(cases)(
    "押す順 %i 番目のマスを %i 回目に押すこと",
    (order, expected) => {
      const slot = getZukanStampSlot(order);

      expect(slot).toBe(expected);
    },
  );
});

describe("countZukanStampSlots", () => {
  const cases = [
    [0, 0],
    [3, 3],
    [13, 13],
    [100, 13],
  ] as const;

  test.each(cases)(
    "変化したマスが %i 個なら %i 回に分けて押すこと",
    (changeCount, expected) => {
      const slotCount = countZukanStampSlots(changeCount);

      expect(slotCount).toBe(expected);
    },
  );
});

describe("groupZukanStampSlots", () => {
  describe("変化したマスが13個以上の場合", () => {
    const indices = Array.from({ length: 15 }, (_, order) => order * 10);

    test("12個目までを1つずつ押し、残りを最後の1回にまとめること", () => {
      const slots = groupZukanStampSlots(indices);

      expect(slots).toHaveLength(13);
      expect(slots.slice(0, 12).every((slot) => slot.length === 1)).toBe(true);
      expect(slots[12]).toEqual([120, 130, 140]);
    });
  });
});

describe("planZukanStamps", () => {
  describe("押す回が少ない場合", () => {
    const slotCount = 3;

    test("前回の姿を少し見せてから、一定の間隔で押し始めること", () => {
      const plan = planZukanStamps(slotCount);

      expect(plan.slotStartMs).toEqual([300, 450, 600]);
    });
  });

  describe("押す回が多い場合", () => {
    const slotCount = 13;

    test("全体を1.5秒以内に収めること", () => {
      const plan = planZukanStamps(slotCount);

      expect(plan.endMs).toBeLessThanOrEqual(1500);
    });

    test("押す間隔を詰めても、回の順に押し始めること", () => {
      const plan = planZukanStamps(slotCount);
      const isAscending = plan.slotStartMs.every(
        (startMs, slot) =>
          slot === 0 || startMs > (plan.slotStartMs[slot - 1] ?? 0),
      );

      expect(isAscending).toBe(true);
    });
  });
});

describe("findZukanRevealScrollTop", () => {
  const view = { top: 100, bottom: 500 };
  const scrollTop = 200;

  describe("押すマスの範囲が端から余白を空けて見えている場合", () => {
    const target = { top: 140, bottom: 460 };

    test("動かさないこと", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBeNull();
    });
  });

  describe("見える範囲に入る範囲が下にはみ出している場合", () => {
    const target = { top: 400, bottom: 600 };

    test("範囲の下端が余白を空けて見える所まで、最小の量だけ下へスクロールすること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 600 - (500 - 32));
    });
  });

  describe("見える範囲に入る範囲が上にはみ出している場合", () => {
    const target = { top: 50, bottom: 150 };

    test("範囲の上端が余白を空けて見える所まで、最小の量だけ上へスクロールすること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 50 - (100 + 32));
    });
  });

  describe("範囲が見える範囲より大きい場合", () => {
    const target = { top: 300, bottom: 1300 };

    test("範囲の上端を見える範囲の上端へ余白を空けて寄せること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 300 - (100 + 32));
    });
  });

  describe("台紙の先頭より上へ寄せることになる場合", () => {
    const target = { top: -200, bottom: 0 };

    test("台紙の先頭で止めること", () => {
      const top = findZukanRevealScrollTop(view, 100, target);

      expect(top).toBe(0);
    });
  });
});

describe("findZukanFollowScrollTop", () => {
  const view = { top: 100, bottom: 500 };
  const scrollTop = 200;
  const rest = { top: 480, bottom: 1400 };

  describe("次に押すマスが見えている場合", () => {
    const next = { top: 300, bottom: 316 };

    test("まだ押していないマスが見えていなくても動かさないこと", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, rest);

      expect(top).toBeNull();
    });
  });

  describe("次に押すマスが見えておらず、残りのマスが見える範囲に入らない場合", () => {
    const next = { top: 480, bottom: 496 };

    test("次に押すマスを見える範囲の上端へ余白を空けて寄せること", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, rest);

      expect(top).toBe(scrollTop + 480 - (100 + 32));
    });
  });

  describe("次に押すマスが見えておらず、残りのマスが見える範囲に入る場合", () => {
    const next = { top: 480, bottom: 496 };
    const fittingRest = { top: 480, bottom: 700 };

    test("残りのマスが全部見える所まで、最小の量だけスクロールすること", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, fittingRest);

      expect(top).toBe(scrollTop + 700 - (500 - 32));
    });
  });
});

type FakeAnimation = Animation & {
  keyframes: Keyframe[];
  finish: () => void;
};

function createFakeElement(animations: FakeAnimation[]): Element {
  return {
    animate: vi.fn((keyframes: Keyframe[]) => {
      let resolveFinished: (animation: Animation) => void = () => {};
      let rejectFinished: (reason: unknown) => void = () => {};
      const animation = {
        keyframes,
        finished: new Promise<Animation>((resolve, reject) => {
          resolveFinished = resolve;
          rejectFinished = reject;
        }),
        cancel: vi.fn(() => rejectFinished(new DOMException("", "AbortError"))),
        finish: () => resolveFinished(animation as unknown as Animation),
      };
      animation.finished.catch(() => {});
      animations.push(animation as unknown as FakeAnimation);
      return animation;
    }),
  } as unknown as Element;
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const compositableProperties = new Set([
  "transform",
  "opacity",
  "offset",
  "easing",
]);

describe("playZukanStamp", () => {
  let animations: FakeAnimation[];
  let parts: ZukanStampParts;
  let onLanded: ReturnType<typeof vi.fn<() => void>>;
  let onFinished: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    animations = [];
    parts = {
      face: createFakeElement(animations),
      shadow: createFakeElement(animations),
      ring: createFakeElement(animations),
    };
    onLanded = vi.fn<() => void>();
    onFinished = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("動きを減らさない設定の場合", () => {
    test("押す姿の動きが終わるまでは、マスに着いたことを知らせないこと", async () => {
      playZukanStamp(parts, { onLanded, onFinished });
      await flushPromises();

      expect(onLanded).not.toHaveBeenCalled();
    });

    test("押す姿の動きが終わるとマスに着いたことを知らせ、戻りと輪の動きが終わると終わったことを知らせること", async () => {
      playZukanStamp(parts, { onLanded, onFinished });
      for (const animation of [...animations]) {
        animation.finish();
      }
      await flushPromises();
      const landedBeforeSettle = onLanded.mock.calls.length;
      const finishedBeforeSettle = onFinished.mock.calls.length;
      for (const animation of animations.slice(2)) {
        animation.finish();
      }
      await flushPromises();

      expect([landedBeforeSettle, finishedBeforeSettle]).toEqual([1, 0]);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    test("変形と透明度だけを動かすこと", async () => {
      playZukanStamp(parts, { onLanded, onFinished });
      for (const animation of [...animations]) {
        animation.finish();
      }
      await flushPromises();
      const animatedProperties = new Set(
        animations.flatMap(({ keyframes }) =>
          keyframes.flatMap((keyframe) => Object.keys(keyframe)),
        ),
      );

      expect(
        [...animatedProperties].every((property) =>
          compositableProperties.has(property),
        ),
      ).toBe(true);
    });

    test("取り消すと、着いたことも終わったことも知らせないこと", async () => {
      const cancel = playZukanStamp(parts, { onLanded, onFinished });

      cancel();
      await flushPromises();

      expect(onLanded).not.toHaveBeenCalled();
      expect(onFinished).not.toHaveBeenCalled();
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("動かさずに、すぐにマスに着いて終わったことを知らせること", () => {
      playZukanStamp(parts, { onLanded, onFinished });

      expect(animations).toEqual([]);
      expect(onLanded).toHaveBeenCalledTimes(1);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });
});
