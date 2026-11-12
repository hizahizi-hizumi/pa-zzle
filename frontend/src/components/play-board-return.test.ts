import {
  _private,
  leavePlayBoard,
  settlePlayBoard,
} from "@/components/play-board-return";

const {
  HANDOFF_LIMIT_MS,
  SETTLE_MS,
  YIELD_HIDE_MS,
  YIELD_REVEAL_MS,
  PATH_SAMPLE_COUNT,
} = _private;

type ControlledAnimation = {
  animation: Animation;
  finish: () => void;
};

/** 終わるときをテストが決める Animation を作る。取り消すと、終わらずに中断する。止めて時刻を指定できる。 */
function createControlledAnimation(): ControlledAnimation {
  let resolveFinished: (animation: Animation) => void = () => {};
  let rejectFinished: (reason: unknown) => void = () => {};
  const animation = {
    currentTime: 0,
    finished: new Promise<Animation>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    }),
    cancel: vi.fn(() => {
      rejectFinished(new DOMException("", "AbortError"));
    }),
    pause: vi.fn(),
    play: vi.fn(),
  } as unknown as Animation;
  animation.finished.catch(() => {});
  return { animation, finish: () => resolveFinished(animation) };
}

/** Animation の終わりを受けた後始末が済むまで待つ。 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** プレイ画面の外枠と、その中の盤面。 */
function createPlayFrame() {
  const playFrame = document.createElement("section");
  playFrame.dataset.playFrame = "";
  const playBoard = document.createElement("div");
  playBoard.dataset.playEntryBoard = "";
  playFrame.append(playBoard);
  return { playFrame, playBoard };
}

/** ゲームのホームの、盤面を描く枠。中に盤面がある。 */
function createPreview() {
  const preview = document.createElement("div");
  const homeBoard = document.createElement("div");
  homeBoard.dataset.playEntryBoard = "";
  homeBoard.textContent = "ホームの盤面";
  preview.append(homeBoard);
  return { preview, homeBoard };
}

/** body の直下に置いた、縮んでいく盤面の写し。 */
function queryFlyingBoard(): HTMLElement | null {
  return (
    [...document.body.children].find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child !== preview &&
        child.textContent === "ホームの盤面",
    ) ?? null
  );
}

/** プレイ画面の盤面は、左上 (100, 200)・幅 400 の所にある。 */
const playBoardRect = new DOMRect(100, 200, 400, 400);
/** ゲームのホームの盤面は、左上 (50, 80)・幅 200 の所にある。 */
const homeBoardRect = new DOMRect(50, 80, 200, 200);
/** 盤面を描く枠は、左上 (40, 60) の所にある。 */
const previewRect = new DOMRect(40, 60, 220, 240);
/**
 * 写しは、枠を 2 倍の大きさで描き、中の盤面がプレイ画面の盤面に重なる所（左上 (80, 160)）に置く。
 * そこから、ホームの盤面を描く枠の所へ縮める変形。
 */
const expectedCopyBox = { left: "80px", top: "160px", width: "440px" };
const expectedSettledTransform = "translate(-40px, -100px) scale(0.5)";

let now: number;
let animations: ControlledAnimation[];
let animate: ReturnType<typeof vi.fn>;
let rects: Map<Element, DOMRect>;
let playFrame: HTMLElement;
let playBoard: HTMLElement;
let preview: HTMLElement;
let homeBoard: HTMLElement;

/** 縮んでいく盤面の写しを測った位置と大きさ。収まるまでの時刻の比で、プレイ画面の盤面からホームの盤面へまっすぐ移る。 */
function measureFlyingBoard(): DOMRect {
  const progress =
    Number(animations[0]?.animation.currentTime ?? 0) / SETTLE_MS;
  function mix(from: number, to: number) {
    return from + (to - from) * progress;
  }
  return new DOMRect(
    mix(playBoardRect.left, homeBoardRect.left),
    mix(playBoardRect.top, homeBoardRect.top),
    mix(playBoardRect.width, homeBoardRect.width),
    mix(playBoardRect.height, homeBoardRect.height),
  );
}

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  animations = [];
  animate = vi.fn(() => {
    const controlled = createControlledAnimation();
    animations.push(controlled);
    return controlled.animation;
  });
  Element.prototype.animate = animate as unknown as Element["animate"];
  ({ playFrame, playBoard } = createPlayFrame());
  ({ preview, homeBoard } = createPreview());
  document.body.append(playFrame, preview);
  rects = new Map<Element, DOMRect>([
    [playBoard, playBoardRect],
    [homeBoard, homeBoardRect],
    [preview, previewRect],
  ]);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function measure(this: Element) {
      const flying = queryFlyingBoard();
      if (this === flying) {
        const { left, top, width, height } = flying.style;
        return new DOMRect(
          parseFloat(left),
          parseFloat(top),
          parseFloat(width),
          parseFloat(height),
        );
      }
      const isFlyingBoard =
        this.matches("[data-play-entry-board]") &&
        flying?.contains(this) === true;
      return isFlyingBoard
        ? measureFlyingBoard()
        : (rects.get(this) ?? new DOMRect());
    },
  );
});

afterEach(() => {
  _private.reset();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("settlePlayBoard", () => {
  describe("プレイ画面の盤面を控えた場合", () => {
    beforeEach(() => {
      leavePlayBoard();
    });

    test("盤面の写しをプレイ画面での大きさで描いてプレイ画面の盤面に重ね、今の所へ、左上を基点に縮めること", () => {
      settlePlayBoard(preview);
      const [keyframes] = animate.mock.calls[0] ?? [];
      const animated = animate.mock.contexts[0];
      const flying = queryFlyingBoard();

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animated).toBe(flying);
      expect(flying?.style).toMatchObject({
        ...expectedCopyBox,
        transformOrigin: "top left",
      });
      expect(keyframes).toEqual([
        { transform: "none" },
        { transform: expectedSettledTransform },
      ]);
    });

    test("収まるまでは、元の盤面を見せずに置くこと", () => {
      settlePlayBoard(preview);

      expect(preview.style.opacity).toBe("0");
    });

    test("収まると、写しを除いて元の盤面を見せ、控えを消してもう一度呼んでも動かさないこと", async () => {
      settlePlayBoard(preview);
      animations[0]?.finish();
      await flushMicrotasks();
      settlePlayBoard(preview);

      expect(queryFlyingBoard()).toBeNull();
      expect(preview.style.opacity).toBe("");
      expect(animate).toHaveBeenCalledTimes(1);
    });

    test("途中でやめると動きを取り消して写しを除き、控えを残して、もう一度呼べば同じように動かすこと", async () => {
      const cancel = settlePlayBoard(preview);
      cancel();
      await flushMicrotasks();
      const flyingAfterCancel = queryFlyingBoard();
      const opacityAfterCancel = preview.style.opacity;
      settlePlayBoard(preview);
      const transforms = animate.mock.calls.map(
        ([keyframes]) => (keyframes as Keyframe[]).at(-1)?.transform,
      );

      expect(animations[0]?.animation.cancel).toHaveBeenCalledTimes(1);
      expect(flyingAfterCancel).toBeNull();
      expect(opacityAfterCancel).toBe("");
      expect(transforms).toEqual([
        expectedSettledTransform,
        expectedSettledTransform,
      ]);
    });

    describe("縮んでいく盤面と重なる要素と、重ならない要素を渡した場合", () => {
      const step = SETTLE_MS / PATH_SAMPLE_COUNT;
      /** プレイ画面の盤面の右下の角にだけ重なる要素。盤面が縮み始めてすぐ離れる。 */
      const crossed = document.createElement("p");
      /** 盤面が `crossed` と最後に重なる時点の、次の時点。 */
      const crossedUntilMs = step * 4;
      /** 縮み始めた盤面が、途中から重なる要素。 */
      const approached = document.createElement("p");
      /** 盤面が `approached` と最初に重なる時点。 */
      const approachedFromMs = step * 5;
      /** 盤面の通り道から外れた要素。 */
      const untouched = document.createElement("p");

      /** 渡した要素に掛けた動きのキーフレームと設定。掛けていなければ `undefined`。 */
      function readYield(element: Element) {
        const index = animate.mock.contexts.indexOf(element);
        return index === -1 ? undefined : animate.mock.calls[index];
      }

      beforeEach(() => {
        rects.set(crossed, new DOMRect(450, 550, 40, 40));
        rects.set(approached, new DOMRect(60, 150, 30, 30));
        rects.set(untouched, new DOMRect(900, 0, 40, 40));
      });

      test("初めから重なる要素を、盤面が通り過ぎるまで見せずに置き、そのあと現すこと", () => {
        settlePlayBoard(preview, [crossed, approached, untouched]);
        const [keyframes, options] = readYield(crossed) ?? [];
        const duration = crossedUntilMs + YIELD_REVEAL_MS;

        expect(keyframes).toEqual([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: crossedUntilMs / duration },
          { opacity: 1, offset: 1 },
        ]);
        expect(options).toMatchObject({ duration });
      });

      test("途中から重なる要素を、重なる直前まで見せておき、重なり始めるまでに消しきること", () => {
        settlePlayBoard(preview, [crossed, approached, untouched]);
        const [keyframes, options] = readYield(approached) ?? [];
        const duration = SETTLE_MS + YIELD_REVEAL_MS;

        expect(keyframes).toEqual([
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: (approachedFromMs - YIELD_HIDE_MS) / duration },
          { opacity: 0, offset: approachedFromMs / duration },
          { opacity: 0, offset: SETTLE_MS / duration },
          { opacity: 1, offset: 1 },
        ]);
        expect(options).toMatchObject({ duration });
      });

      test("重ならない要素は動かさないこと", () => {
        settlePlayBoard(preview, [crossed, approached, untouched]);
        const untouchedYield = readYield(untouched);

        expect(untouchedYield).toBeUndefined();
      });

      test("通り道を測ったあと、縮める動きを始めから動かすこと", () => {
        settlePlayBoard(preview, [crossed, untouched]);
        const settle = animations[0]?.animation;

        expect(settle?.currentTime).toBe(0);
        expect(settle?.play).toHaveBeenCalled();
      });

      test("途中でやめると、見せずに置いた要素を元の姿に戻すこと", () => {
        const cancel = settlePlayBoard(preview, [crossed, untouched]);
        cancel();
        const reveal = animations[1]?.animation;

        expect(reveal?.cancel).toHaveBeenCalledTimes(1);
      });
    });

    describe.each([
      ["控えてから期限ちょうどの時間が経った", HANDOFF_LIMIT_MS, 1],
      ["控えてから期限を過ぎた", HANDOFF_LIMIT_MS + 1, 0],
    ] as const)("%s場合", (_, elapsedMs, expectedCount) => {
      beforeEach(() => {
        now = elapsedMs;
      });

      test(`${expectedCount === 1 ? "動かす" : "動かさない"}こと`, () => {
        settlePlayBoard(preview);

        expect(animate).toHaveBeenCalledTimes(expectedCount);
      });
    });

    describe("盤面の枠の中に盤面が無い場合", () => {
      beforeEach(() => {
        homeBoard.remove();
      });

      test("動かさないこと", () => {
        settlePlayBoard(preview);

        expect(animate).not.toHaveBeenCalled();
      });
    });

    describe("ゲームのホームの盤面の幅が 0 の場合", () => {
      beforeEach(() => {
        rects.set(homeBoard, new DOMRect(50, 80, 0, 0));
      });

      test("動かさないこと", () => {
        settlePlayBoard(preview);

        expect(animate).not.toHaveBeenCalled();
      });
    });

    describe("動かせない環境の場合", () => {
      beforeEach(() => {
        Reflect.deleteProperty(Element.prototype, "animate");
      });

      test("何もせず、やめる関数を呼んでも失敗しないこと", () => {
        const act = () => settlePlayBoard(preview)();

        expect(act).not.toThrow();
      });
    });
  });

  describe("プレイ画面の盤面の幅が 0 で控えた場合", () => {
    beforeEach(() => {
      rects.set(playBoard, new DOMRect(100, 200, 0, 0));
      leavePlayBoard();
    });

    test("動かさないこと", () => {
      settlePlayBoard(preview);

      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("何も控えていない場合", () => {
    test("動かさないこと", () => {
      settlePlayBoard(preview);

      expect(animate).not.toHaveBeenCalled();
    });
  });
});

describe("leavePlayBoard", () => {
  describe("プレイ画面の外枠の外にだけ盤面がある場合", () => {
    beforeEach(() => {
      playFrame.remove();
    });

    test("位置を控えず、そのあと収めようとしても動かさないこと", () => {
      leavePlayBoard();
      settlePlayBoard(preview);

      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("控えたあと、盤面の無い画面から離れた場合", () => {
    beforeEach(() => {
      leavePlayBoard();
      playFrame.remove();
    });

    test("前の控えを消し、そのあと収めようとしても動かさないこと", () => {
      leavePlayBoard();
      settlePlayBoard(preview);

      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      leavePlayBoard();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("盤面があっても前の控えを消し、そのあと収めようとしても動かさないこと", () => {
      leavePlayBoard();
      settlePlayBoard(preview);

      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("時刻 0 より後に控え、そこから期限ちょうどの時間が経った場合", () => {
    const leftAt = 5000;

    beforeEach(() => {
      now = leftAt;
      leavePlayBoard();
      now = leftAt + HANDOFF_LIMIT_MS;
    });

    test("控えた時刻から期限を数え、盤面を動かすこと", () => {
      settlePlayBoard(preview);

      expect(animate).toHaveBeenCalledTimes(1);
    });
  });
});
