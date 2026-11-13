import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  test,
  vi,
} from "vitest";
import {
  _private,
  canRunScreenTransition,
  runScreenTransition,
} from "@/lib/screen-transition";

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

  describe("動きを使えない環境の場合", () => {
    let navigate: Mock<() => void>;

    beforeEach(() => {
      navigate = vi.fn<() => void>();
    });

    test("動かさずに行き来すること", async () => {
      await runScreenTransition("close", navigate);

      expect(navigate).toHaveBeenCalledOnce();
    });
  });

  describe("動きを使える環境の場合", () => {
    let startViewTransition: ReturnType<typeof stubStartViewTransition>;
    let navigate: Mock<() => void>;

    beforeEach(() => {
      startViewTransition = stubStartViewTransition();
      navigate = vi.fn<() => void>();
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        stubReducedMotion(true);
      });

      test("動かさずに行き来すること", async () => {
        await runScreenTransition("close", navigate);

        expect(navigate).toHaveBeenCalledOnce();
        expect(startViewTransition).not.toHaveBeenCalled();
      });
    });

    describe("ダイアログが開いている場合", () => {
      beforeEach(() => {
        stubReducedMotion(false);
        document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
      });

      test("動かさずに行き来すること", async () => {
        await runScreenTransition("close", navigate);

        expect(navigate).toHaveBeenCalledOnce();
        expect(startViewTransition).not.toHaveBeenCalled();
      });

      test("canRunScreenTransition が false を返すこと", () => {
        const canRun = canRunScreenTransition();

        expect(canRun).toBe(false);
      });
    });

    describe("動きを減らさない設定の場合", () => {
      let kindsDuringNavigate: (string | null)[];
      let steps: string[];

      function recordKind() {
        kindsDuringNavigate.push(
          document.documentElement.getAttribute("data-screen-transition"),
        );
      }

      beforeEach(() => {
        stubReducedMotion(false);
        kindsDuringNavigate = [];
        steps = [];
      });

      test("canRunScreenTransition が true を返すこと", () => {
        const canRun = canRunScreenTransition();

        expect(canRun).toBe(true);
      });

      test("動きの中で行き来し、終わったら動きの種類の目印を外すこと", async () => {
        await runScreenTransition("close", recordKind);
        await Promise.resolve();

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(kindsDuringNavigate).toEqual(["close"]);
        expect(
          document.documentElement.hasAttribute("data-screen-transition"),
        ).toBe(false);
      });

      test("運ぶものの、行き来の前の動き・行き来・後の動きの順に進めること", async () => {
        await runScreenTransition(
          "settle",
          function navigateStep() {
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

      describe("動きの途中に重ねて行き来が起きた場合", () => {
        let finishFirstNavigate: () => void;
        let firstNavigate: Mock<() => Promise<void>>;
        let first: Promise<void>;

        beforeEach(async () => {
          firstNavigate = vi.fn<() => Promise<void>>(
            () =>
              new Promise<void>((resolve) => {
                finishFirstNavigate = resolve;
              }),
          );
          first = runScreenTransition("close", firstNavigate);
          await vi.waitFor(() => expect(firstNavigate).toHaveBeenCalledOnce());
        });

        afterEach(async () => {
          finishFirstNavigate();
          await first;
        });

        test("重ねて起きた行き来を受けないこと", async () => {
          await runScreenTransition("close", navigate);

          expect(navigate).not.toHaveBeenCalled();
        });

        test("canRunScreenTransition が false を返すこと", () => {
          const canRun = canRunScreenTransition();

          expect(canRun).toBe(false);
        });
      });

      describe("動きを飛ばした場合", () => {
        let skipCarrier: Mock<() => void>;

        beforeEach(async () => {
          skipCarrier = vi.fn<() => void>();
          await runScreenTransition("return", navigate, {
            after: () => new Promise<void>(() => {}),
            skip: skipCarrier,
          });
        });

        test("運ぶものにも、飛ばされたことを伝えること", () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

          expect(skipCarrier).toHaveBeenCalledOnce();
        });
      });
    });
  });
});
