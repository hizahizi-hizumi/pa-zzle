import { afterEach, describe, expect, test, vi } from "vitest";
import {
  _private,
  runScreenTransition,
  screenTransitionKind,
} from "@/lib/screen-transition";

describe("screenTransitionKind", () => {
  const home = "/";
  const gameHome = "/puzzles/water-sort";
  const play = "/puzzles/water-sort/play/1";
  const result = "/puzzles/water-sort/result/water-sort%3A1%3A2";
  const crossingCases = [
    [home, gameHome, "enter-game"],
    [gameHome, home, "leave-game"],
    [play, result, "settle"],
    [result, play, "open"],
    [result, gameHome, "return"],
    [result, home, "close"],
    [play, home, "close"],
  ] as const;
  const nonCrossingCases = [
    [gameHome, play],
    [play, gameHome],
    [play, play],
    [home, "/records"],
    ["/records", result],
  ] as const;

  test.each(crossingCases)(
    "額の外と内をまたぐ行き来 %s → %s に、動きの種類 %s を返すこと",
    (from, to, expectedKind) => {
      const kind = screenTransitionKind(from, to);

      expect(kind).toBe(expectedKind);
    },
  );

  test.each(nonCrossingCases)(
    "額の外と内をまたがない行き来 %s → %s に、null を返すこと",
    (from, to) => {
      const kind = screenTransitionKind(from, to);

      expect(kind).toBeNull();
    },
  );
});

describe("runScreenTransition", () => {
  type ViewTransitionStub = {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };

  function stubStartViewTransition() {
    const startViewTransition = vi.fn(
      (update: () => Promise<void>): ViewTransitionStub => {
        const updateCallbackDone = update();
        return {
          ready: updateCallbackDone,
          finished: updateCallbackDone,
          updateCallbackDone,
          skipTransition: vi.fn(),
        };
      },
    );
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    return startViewTransition;
  }

  function stubReducedMotion(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced })),
    );
  }

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-screen-transition");
    _private.resetForTest();
  });

  test("動きを使えない環境では、動かさずに行き来すること", async () => {
    const navigate = vi.fn();

    await runScreenTransition("close", navigate);

    expect(navigate).toHaveBeenCalledOnce();
  });

  test("動きを減らす設定では、動かさずに行き来すること", async () => {
    const startViewTransition = stubStartViewTransition();
    stubReducedMotion(true);
    const navigate = vi.fn();

    await runScreenTransition("close", navigate);

    expect(navigate).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  test("ダイアログが開いている間は、動かさずに行き来すること", async () => {
    const startViewTransition = stubStartViewTransition();
    stubReducedMotion(false);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    const navigate = vi.fn();

    await runScreenTransition("close", navigate);

    expect(navigate).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  test("動かすときは、動きの中で行き来し、終わったら動きの種類の目印を外すこと", async () => {
    const startViewTransition = stubStartViewTransition();
    stubReducedMotion(false);
    const kindsDuringNavigate: (string | null)[] = [];
    function navigate() {
      kindsDuringNavigate.push(
        document.documentElement.getAttribute("data-screen-transition"),
      );
    }

    await runScreenTransition("close", navigate);
    await Promise.resolve();

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(kindsDuringNavigate).toEqual(["close"]);
    expect(
      document.documentElement.hasAttribute("data-screen-transition"),
    ).toBe(false);
  });

  test("動きの途中に重ねて起きた行き来は受けないこと", async () => {
    stubStartViewTransition();
    stubReducedMotion(false);
    let finishFirstNavigate = () => {};
    const firstNavigate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFirstNavigate = resolve;
        }),
    );
    const secondNavigate = vi.fn();

    const first = runScreenTransition("close", firstNavigate);
    await vi.waitFor(() => expect(firstNavigate).toHaveBeenCalledOnce());
    await runScreenTransition("close", secondNavigate);
    finishFirstNavigate();
    await first;

    expect(secondNavigate).not.toHaveBeenCalled();
  });

  test("運ぶものがあるときは、行き来の前の動き・行き来・後の動きの順に進めること", async () => {
    stubStartViewTransition();
    stubReducedMotion(false);
    const steps: string[] = [];

    await runScreenTransition(
      "settle",
      () => {
        steps.push("navigate");
      },
      {
        before() {
          steps.push("before");
        },
        after() {
          steps.push("after");
        },
      },
    );

    expect(steps).toEqual(["before", "navigate", "after"]);
  });
});
