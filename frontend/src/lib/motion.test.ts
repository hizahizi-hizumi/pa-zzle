import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  prefersReducedMotion,
  waitForAnimations,
} from "@/lib/motion";

/** 値の正である `@theme` を持つ CSS。 */
const theme = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../styles/globals.css",
  ),
  "utf8",
);

type FakeAnimation = Animation & { finish: () => void };

function createFakeAnimation(): FakeAnimation {
  let resolveFinished: (animation: Animation) => void = () => {};
  let rejectFinished: (reason: unknown) => void = () => {};
  const animation = {
    finished: new Promise<Animation>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    }),
    cancel: vi.fn(() => rejectFinished(new DOMException("", "AbortError"))),
    finish: () => resolveFinished(animation as unknown as Animation),
  };
  // ブラウザと同じく、取り消しで拒否される finished を処理済みとして扱う。
  animation.finished.catch(() => {});
  return animation as unknown as FakeAnimation;
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced }) as MediaQueryList),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MOTION_DURATION_MS", () => {
  const cases = Object.entries(MOTION_DURATION_MS);

  test.each(cases)(
    "@theme の --duration-%s と同じ値であること",
    (name, durationMs) => {
      const declaration = `--duration-${name}: ${durationMs}ms;`;

      expect(theme).toContain(declaration);
    },
  );
});

describe("MOTION_EASING", () => {
  const cases = Object.entries(MOTION_EASING);

  test.each(cases)("@theme の --ease-%s と同じ値であること", (name, easing) => {
    const declaration = `--ease-${name}: ${easing};`;

    expect(theme).toContain(declaration);
  });
});

describe("prefersReducedMotion", () => {
  describe.each([
    ["動きを減らす設定", true],
    ["動きを減らさない設定", false],
  ] as const)("%sの場合", (_, reduced) => {
    beforeEach(() => {
      stubReducedMotion(reduced);
    });

    test("設定どおりの値を返すこと", () => {
      const result = prefersReducedMotion();

      expect(result).toBe(reduced);
    });
  });

  describe("matchMedia が無い環境の場合", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", undefined);
    });

    test("動きを減らさない設定として扱うこと", () => {
      const result = prefersReducedMotion();

      expect(result).toBe(false);
    });
  });
});

describe("waitForAnimations", () => {
  let animations: FakeAnimation[];
  let onFinished: ReturnType<typeof vi.fn<() => void>>;
  let stopWaiting: () => void;

  beforeEach(() => {
    animations = [createFakeAnimation(), createFakeAnimation()];
    onFinished = vi.fn<() => void>();
    stopWaiting = waitForAnimations(animations, onFinished);
  });

  test("すべての Animation が終わってから一度だけ通知すること", async () => {
    animations[0]?.finish();
    await flushPromises();
    const calledBeforeAll = onFinished.mock.calls.length;
    animations[1]?.finish();
    await flushPromises();
    const calledAfterAll = onFinished.mock.calls.length;

    expect([calledBeforeAll, calledAfterAll]).toEqual([0, 1]);
  });

  test("待つのをやめた後は通知しないこと", async () => {
    stopWaiting();
    for (const animation of animations) {
      animation.finish();
    }
    await flushPromises();

    expect(onFinished).not.toHaveBeenCalled();
  });

  test("Animation が取り消された後は通知しないこと", async () => {
    animations[0]?.cancel();
    animations[1]?.finish();
    await flushPromises();

    expect(onFinished).not.toHaveBeenCalled();
  });
});

describe("playAnimations", () => {
  const holdMs = 240;
  const durationMs = 1_760;
  const reducedMotionHoldMs = 700;
  const unanimatedHoldMs = 900;
  let animation: FakeAnimation;
  let animate: ReturnType<typeof vi.fn<() => readonly Animation[]>>;
  let onFinished: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    animation = createFakeAnimation();
    onFinished = vi.fn<() => void>();
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      stubReducedMotion(true);
      animate = vi.fn(() => [animation]);
    });

    test("演出せずに、ゲームが渡した時間だけ止まった姿を見せてから一度だけ通知すること", async () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs,
        unanimatedHoldMs,
        onFinished,
      });
      await vi.advanceTimersByTimeAsync(reducedMotionHoldMs - 1);
      const calledBeforeHold = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      const calledAfterHold = onFinished.mock.calls.length;

      expect([
        animate.mock.calls.length,
        calledBeforeHold,
        calledAfterHold,
      ]).toEqual([0, 0, 1]);
    });

    test("見せておく時間が0ならすぐ通知すること", () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs: 0,
        unanimatedHoldMs,
        onFinished,
      });

      expect(onFinished).toHaveBeenCalledOnce();
    });

    describe("取り消した場合", () => {
      beforeEach(() => {
        const cancel = playAnimations({
          animate,
          completion: { type: "after-animations", holdMs },
          reducedMotionHoldMs,
          unanimatedHoldMs,
          onFinished,
        });
        cancel();
      });

      test("見せておく時間が経っても通知しないこと", async () => {
        await vi.advanceTimersByTimeAsync(reducedMotionHoldMs);

        expect(onFinished).not.toHaveBeenCalled();
      });
    });
  });

  describe("動かせる要素が無い場合", () => {
    beforeEach(() => {
      stubReducedMotion(false);
      animate = vi.fn(() => []);
    });

    test("ゲームが渡した時間が経ってから一度だけ通知すること", async () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs,
        unanimatedHoldMs,
        onFinished,
      });
      await vi.advanceTimersByTimeAsync(unanimatedHoldMs - 1);
      const calledBeforeHold = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      const calledAfterHold = onFinished.mock.calls.length;

      expect([calledBeforeHold, calledAfterHold]).toEqual([0, 1]);
    });

    test("待つ時間が0ならすぐ通知すること", () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs,
        unanimatedHoldMs: 0,
        onFinished,
      });

      expect(onFinished).toHaveBeenCalledOnce();
    });
  });

  describe("演出が終わってから完了する場合", () => {
    beforeEach(() => {
      stubReducedMotion(false);
      animate = vi.fn(() => [animation]);
    });

    test("演出が終わって見せておく時間が経ってから一度だけ通知すること", async () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs,
        unanimatedHoldMs,
        onFinished,
      });
      animation.finish();
      await vi.advanceTimersByTimeAsync(holdMs - 1);
      const calledBeforeHold = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      const calledAfterHold = onFinished.mock.calls.length;

      expect([calledBeforeHold, calledAfterHold]).toEqual([0, 1]);
    });

    test("演出が終わるまでは通知しないこと", async () => {
      playAnimations({
        animate,
        completion: { type: "after-animations", holdMs },
        reducedMotionHoldMs,
        unanimatedHoldMs,
        onFinished,
      });
      await vi.advanceTimersByTimeAsync(durationMs);

      expect(onFinished).not.toHaveBeenCalled();
    });

    describe("取り消した場合", () => {
      beforeEach(async () => {
        const cancel = playAnimations({
          animate,
          completion: { type: "after-animations", holdMs },
          reducedMotionHoldMs,
          unanimatedHoldMs,
          onFinished,
        });
        animation.finish();
        await vi.advanceTimersByTimeAsync(0);
        cancel();
      });

      test("見せておく時間が経っても通知しないこと", async () => {
        await vi.advanceTimersByTimeAsync(holdMs);

        expect(onFinished).not.toHaveBeenCalled();
      });

      test("演出を止めること", () => {
        const cancelled = animation.cancel;

        expect(cancelled).toHaveBeenCalledOnce();
      });
    });
  });

  describe("始めてから決まった時間で完了する場合", () => {
    beforeEach(() => {
      stubReducedMotion(false);
      animate = vi.fn(() => [animation]);
    });

    test("演出の終わりによらず、ゲームが渡した時間が経ってから一度だけ通知すること", async () => {
      playAnimations({
        animate,
        completion: { type: "after-duration", durationMs },
        reducedMotionHoldMs,
        unanimatedHoldMs,
        onFinished,
      });
      animation.finish();
      await vi.advanceTimersByTimeAsync(durationMs - 1);
      const calledBeforeDuration = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      const calledAfterDuration = onFinished.mock.calls.length;

      expect([calledBeforeDuration, calledAfterDuration]).toEqual([0, 1]);
    });

    describe("取り消した場合", () => {
      beforeEach(() => {
        const cancel = playAnimations({
          animate,
          completion: { type: "after-duration", durationMs },
          reducedMotionHoldMs,
          unanimatedHoldMs,
          onFinished,
        });
        cancel();
      });

      test("時間が経っても通知しないこと", async () => {
        await vi.advanceTimersByTimeAsync(durationMs);

        expect(onFinished).not.toHaveBeenCalled();
      });

      test("演出を止めること", () => {
        const cancelled = animation.cancel;

        expect(cancelled).toHaveBeenCalledOnce();
      });
    });
  });
});

describe("playRejectionShake", () => {
  const keyframes: Keyframe[] = [
    { transform: "translateX(0)" },
    { transform: "translateX(4px)" },
    { transform: "translateX(0)" },
  ];
  const timing = { durationMs: 220, easing: "ease-out" };
  let element: HTMLElement;
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    element = document.createElement("div");
    animate = vi.fn();
    element.animate = animate as unknown as HTMLElement["animate"];
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      stubReducedMotion(true);
    });

    test("揺らさないこと", () => {
      playRejectionShake(element, keyframes, timing);

      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      stubReducedMotion(false);
    });

    test("ゲームが渡した揺れ方・長さ・緩急で揺らすこと", () => {
      playRejectionShake(element, keyframes, timing);

      expect(animate).toHaveBeenCalledWith(keyframes, {
        duration: 220,
        easing: "ease-out",
      });
    });
  });
});
