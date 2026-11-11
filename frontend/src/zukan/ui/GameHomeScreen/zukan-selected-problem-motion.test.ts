import {
  concealSelectedProblemBoard,
  detachSelectedProblemBoard,
  revealSelectedProblem,
  selectedProblemPartProps,
} from "@/zukan/ui/GameHomeScreen/zukan-selected-problem-motion";

type ControlledAnimation = { animation: Animation; finish: () => void };

/** 終わるときをテストが決める Animation を作る。 */
function createControlledAnimation(): ControlledAnimation {
  let resolveFinished: (animation: Animation) => void = () => {};
  const animation = {
    finished: new Promise<Animation>((resolve) => {
      resolveFinished = resolve;
    }),
    cancel: vi.fn(),
  } as unknown as Animation;
  return { animation, finish: () => resolveFinished(animation) };
}

/** Animation の終わりを受けた後始末が済むまで待つ。 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 選んだ問題の欄。盤面の枠と、番号と操作の欄を持つ。 */
function createPanel() {
  const panel = document.createElement("aside");
  const board = document.createElement("div");
  const info = document.createElement("div");
  for (const [element, part] of [
    [board, "board"],
    [info, "info"],
  ] as const) {
    for (const [name, value] of Object.entries(
      selectedProblemPartProps(part),
    )) {
      element.setAttribute(name, value);
    }
  }
  panel.append(board, info);
  return { panel, board, info };
}

/** 盤面の枠は、左上 (10, 20)・幅 100 の所にある。 */
const boardRect = new DOMRect(10, 20, 100, 100);
/** ピースは、中心 (210, 310)・幅 20 の所にある。 */
const pieceRect = new DOMRect(200, 300, 20, 20);
/** 枠を、左上を基点にピースへ重ねる変形。 */
const atPieceTransform = "translate(190px, 280px) scale(0.2)";

let animations: ControlledAnimation[];
let animate: ReturnType<typeof vi.fn>;
let panel: HTMLElement;
let piece: HTMLElement;

beforeEach(() => {
  animations = [];
  animate = vi.fn(() => {
    const controlled = createControlledAnimation();
    animations.push(controlled);
    return controlled.animation;
  });
  Element.prototype.animate = animate as unknown as Element["animate"];
  ({ panel } = createPanel());
  piece = document.createElement("button");
  document.body.append(panel, piece);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function measure(this: Element) {
      if (this === piece) {
        return pieceRect;
      }
      return this.matches('[data-selected-problem-part="board"]')
        ? boardRect
        : new DOMRect(0, 0, 300, 120);
    },
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 渡した要素への動きの、始めのキーフレーム。 */
function readFirstKeyframe(element: Element | null): Keyframe | undefined {
  const index = animate.mock.contexts.indexOf(element);
  return (animate.mock.calls[index]?.[0] as Keyframe[] | undefined)?.[0];
}

describe("revealSelectedProblem", () => {
  test("盤面の枠を、ピースの位置と大きさから欄の所へ広げること", () => {
    revealSelectedProblem(panel, piece);
    const firstKeyframe = readFirstKeyframe(
      panel.querySelector('[data-selected-problem-part="board"]'),
    );

    expect(firstKeyframe).toEqual({
      transformOrigin: "top left",
      transform: atPieceTransform,
    });
  });

  test("番号と操作を、遅らせずに、薄く見える姿から現すこと", () => {
    revealSelectedProblem(panel, piece);
    const info = panel.querySelector('[data-selected-problem-part="info"]');
    const firstKeyframe = readFirstKeyframe(info);
    const options = animate.mock.calls[
      animate.mock.contexts.indexOf(info)
    ]?.[1] as KeyframeAnimationOptions;

    expect(firstKeyframe?.opacity).toBeGreaterThan(0);
    expect(options.delay ?? 0).toBe(0);
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("動かさないこと", () => {
      revealSelectedProblem(panel, piece);

      expect(animate).not.toHaveBeenCalled();
    });
  });
});

describe("detachSelectedProblemBoard", () => {
  test("盤面の枠だけを写し、読み上げと操作から外して body に置くこと", () => {
    const detached = detachSelectedProblemBoard(panel);

    expect(detached?.parentElement).toBe(document.body);
    expect(detached?.getAttribute("data-selected-problem-part")).toBe("board");
    expect(detached?.getAttribute("aria-hidden")).toBe("true");
    expect(detached?.inert).toBe(true);
  });

  describe("選び替えた直後で、薄れていく前の盤面が枠の中に残っている場合", () => {
    beforeEach(() => {
      const board = panel.querySelector('[data-selected-problem-part="board"]');
      const shown = document.createElement("p");
      shown.textContent = "選び替えた問題の盤面";
      const leaving = document.createElement("p");
      leaving.setAttribute("data-leaving-preview", "");
      leaving.textContent = "前の問題の盤面";
      board?.append(shown, leaving);
    });

    test("写しには、選び替えた問題の盤面だけを残すこと", () => {
      const detached = detachSelectedProblemBoard(panel);
      const boards = [...(detached?.children ?? [])].map(
        (child) => child.textContent,
      );

      expect(boards).toEqual(["選び替えた問題の盤面"]);
    });

    test("元の欄の、薄れていく前の盤面は残すこと", () => {
      detachSelectedProblemBoard(panel);
      const leaving = panel.querySelector("[data-leaving-preview]");

      expect(leaving?.textContent).toBe("前の問題の盤面");
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("写しを置かないこと", () => {
      const detached = detachSelectedProblemBoard(panel);

      expect(detached).toBeNull();
    });
  });
});

describe("concealSelectedProblemBoard", () => {
  let detached: HTMLElement;

  beforeEach(() => {
    detached = detachSelectedProblemBoard(panel) as HTMLElement;
    animate.mockClear();
    animations = [];
  });

  test("呼ばれたその場で、写しの盤面をピースの位置と大きさへ戻して消すこと", () => {
    concealSelectedProblemBoard(detached, piece);
    const index = animate.mock.contexts.indexOf(detached);
    const keyframes = animate.mock.calls[index]?.[0] as Keyframe[];

    expect(keyframes.at(-1)).toEqual({
      transform: atPieceTransform,
      opacity: 0,
    });
  });

  test("盤面がピースへ戻りきると、写しを除くこと", async () => {
    concealSelectedProblemBoard(detached, piece);
    for (const { finish } of animations) {
      finish();
    }
    await flushMicrotasks();

    expect(detached.isConnected).toBe(false);
  });

  describe("ピースが無い場合", () => {
    test("盤面をその場で薄れさせること", () => {
      concealSelectedProblemBoard(detached, null);
      const keyframes = animate.mock.calls[0]?.[0];

      expect(keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    });
  });
});
