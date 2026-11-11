import type { GameResultLevel } from "@/games/result";
import {
  getZukanStampTimeline,
  type ZukanStamp,
  type ZukanStampStyle,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import {
  _private,
  createZukanStampEffectLayer,
  findZukanStampParts,
  measureZukanStampSquareBox,
  playZukanNewPieceMarks,
  startZukanStamp,
  type ZukanStampEffectLayer,
  type ZukanStampMotion,
} from "@/zukan/ui/GameHomeScreen/zukan-stamp-effects";

const { planFlight, getZukanStampTier } = _private;

type RecordedAnimation = {
  element: Element;
  keyframes: Keyframe[];
  animation: Animation;
};

let recorded: RecordedAnimation[];

/** 呼ばれた動きを記録し、終わらない Animation を返す。 */
function recordAnimate(
  this: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
): Animation {
  const animation = {
    finished: new Promise<Animation>(() => {}),
    startTime: null,
    cancel: vi.fn(),
  } as unknown as Animation;
  recorded.push({
    element: this,
    keyframes: keyframes as Keyframe[],
    animation,
  });
  return animation;
}

const columnCount = 3;
const startTime = 1000;
const box = { x: 45, y: 45, size: 30 };
const from = { x: 45, y: 245 };

/**
 * 3列3行の台紙を、スクロール領域・重ね順を閉じた要素・マスを並べた要素の順に入れ子にして作り、真ん中のマスを変化したマスにする。
 * 状態ごとの数の並びも置き、押したときに数を弾ませられるようにする。
 */
function renderSheet({ isRaised }: { isRaised: boolean }) {
  document.body.innerHTML = `
    <ul aria-label="状態ごとの問題の数">
      <li>perfect</li><li>great</li><li>good</li><li>clear</li><li>挑戦中</li><li>未挑戦</li>
    </ul>
    <div data-testid="scroller">
      <div data-testid="sheet">
        <div data-testid="grid" style="grid-template-columns: 1fr 1fr 1fr">
          ${Array.from(
            { length: columnCount * 3 },
            (_, index) =>
              `<button data-index="${index}" ${index === 4 ? 'data-change-stage="stamping"' : ""}>${
                index === 4
                  ? `<span data-stamp-part="shadow"></span><span data-stamp-part="face">${isRaised ? '<span data-stamp-part="previous"></span>' : ""}</span>`
                  : ""
              }</button>`,
          ).join("")}
        </div>
      </div>
    </div>`;
  const sheet = document.querySelector('[data-testid="sheet"]');
  const grid = document.querySelector('[data-testid="grid"]');
  const square = document.querySelector<HTMLElement>('[data-index="4"]');
  const parts = square ? findZukanStampParts(square) : null;
  if (!sheet || !grid || !square || !parts) {
    throw new Error("台紙を作れない");
  }
  return { sheet, grid, square, parts };
}

function listAnimatedElements(): Element[] {
  return recorded.map(({ element }) => element);
}

function findAnimation(element: Element): RecordedAnimation | undefined {
  return recorded.find((animation) => animation.element === element);
}

beforeEach(() => {
  recorded = [];
  Element.prototype.animate = recordAnimate as Element["animate"];
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
  document.body.innerHTML = "";
});

describe("getZukanStampTier", () => {
  const levels: GameResultLevel[] = ["clear", "good", "great", "perfect"];

  test("段階が高いほど大きく飛ばすこと", () => {
    const bonuses = levels.map(
      (level) => getZukanStampTier(level).flightScaleBonus,
    );
    const isAscending = bonuses.every(
      (bonus, index) => index === 0 || bonus > (bonuses[index - 1] ?? 0),
    );

    expect(isAscending).toBe(true);
  });

  test("粒は great から付け、perfect で最も多くすること", () => {
    const particles = levels.map(
      (level) => getZukanStampTier(level).particleCount,
    );

    expect(particles[0]).toBe(0);
    expect(particles[1]).toBe(0);
    expect(particles[3]).toBeGreaterThan(particles[2] ?? 0);
  });

  test("perfect だけを特別に強く見せること", () => {
    const finest = levels.filter((level) => getZukanStampTier(level).isFinest);

    expect(finest).toEqual(["perfect"]);
  });
});

describe("planFlight", () => {
  const from = { x: 200, y: 0 };
  const timeline = getZukanStampTimeline("hero");

  test("離れた所から大きな姿で飛び立ち、上へ膨らむ弧を描いて枠に沈んで着くこと", () => {
    const flight = planFlight(from, 1.9, 0.3, timeline);
    const first = flight[0];
    const last = flight.at(-1);
    const highest = Math.min(...flight.map(({ dy }) => dy));

    expect(first).toEqual({
      atMs: timeline.flightMs,
      dx: 200,
      dy: 0,
      scale: 1.9,
    });
    expect(last?.atMs).toBe(timeline.landMs);
    expect(last?.dx).toBeCloseTo(0);
    expect(last?.dy).toBeCloseTo(0);
    expect(last?.scale).toBeLessThan(1);
    expect(highest).toBeLessThan(0);
  });
});

describe("startZukanStamp", () => {
  let layer: ZukanStampEffectLayer;
  let sheet: ReturnType<typeof renderSheet>;

  function start(
    stamp: ZukanStamp,
    style: ZukanStampStyle,
  ): ZukanStampMotion | null {
    return startZukanStamp(
      { square: sheet.square, parts: sheet.parts, stamp },
      { layer, box, style, from, startTime },
    );
  }

  function landTimeOf(style: ZukanStampStyle): number {
    return startTime + getZukanStampTimeline(style).landMs;
  }

  describe.each(["hero", "featured"] as const)(
    "新しく clear で解いたマスを飛ばしてはめる場合: %s",
    (style) => {
      const stamp: ZukanStamp = { level: "clear", isRaised: false };

      beforeEach(() => {
        sheet = renderSheet({ isRaised: false });
        layer = createZukanStampEffectLayer(sheet.grid);
      });

      test("押す姿と影を、渡された時刻から動かすこと", () => {
        start(stamp, style);
        const startTimes = [sheet.parts.face, sheet.parts.shadow].map(
          (element) => findAnimation(element)?.animation.startTime,
        );

        expect(startTimes).toEqual([startTime, startTime]);
      });

      test("飛び立つ所から大きな姿で始め、枠で沈み、わずかに行き過ぎてから今の大きさに戻すこと", () => {
        start(stamp, style);
        const scales = findAnimation(sheet.parts.face)?.keyframes.map(
          ({ transform }) =>
            Number(/scale\(([\d.]+)\)/.exec(String(transform))?.[1]),
        );

        expect(scales?.[0]).toBeGreaterThan(1.3);
        expect(Math.min(...(scales ?? []))).toBeLessThan(1);
        expect(Math.max(...(scales ?? []).slice(-2))).toBeGreaterThan(1);
        expect(scales?.at(-1)).toBe(1);
      });

      test("飛んでくる前から、行き先の枠だけを層に光らせること", () => {
        start(stamp, style);
        const effectCount = layer.element.children.length;

        expect(effectCount).toBe(1);
      });

      test("押している間、マスを周りのマスより手前に重ねること", () => {
        start(stamp, style);
        const zIndex = sheet.square.style.zIndex;

        expect(zIndex).not.toBe("");
      });

      describe("押し始めている場合", () => {
        let motion: ZukanStampMotion | null;

        beforeEach(() => {
          motion = start(stamp, style);
        });

        test("着いたら層に白い光と、ピースの色の光る円の波紋を描くこと", () => {
          motion?.land(landTimeOf(style));
          const rings = [...layer.element.children].filter(
            (element) =>
              element instanceof HTMLElement &&
              element.style.borderRadius === "50%",
          );

          expect(layer.element.children.length).toBeGreaterThanOrEqual(3);
          expect(rings.length).toBeGreaterThanOrEqual(1);
        });

        test("着いたら、そのマスを明るくしてから元の明るさへ戻すこと", () => {
          motion?.land(landTimeOf(style));
          const filters = recorded
            .filter(({ element }) => element === sheet.square)
            .flatMap(({ keyframes }) => keyframes.map(({ filter }) => filter))
            .filter((filter) => filter !== undefined);

          expect(filters[0]).toMatch(/brightness\(1\.\d+\)/);
          expect(filters.at(-1)).toBe("brightness(1)");
        });

        test("着いた少し後から押す姿を薄れさせ、マスの普段の姿へ渡すこと", () => {
          motion?.land(landTimeOf(style));
          const handOff = recorded.findLast(
            ({ element }) => element === sheet.parts.face,
          );
          const opacities = handOff?.keyframes.map(({ opacity }) => opacity);

          expect(opacities).toEqual([1, 0]);
        });

        describe("着いたあとに取り消した場合", () => {
          beforeEach(() => {
            motion?.land(landTimeOf(style));
          });

          test("層に描いた効果を片付け、マスの重なりを戻すこと", () => {
            motion?.cancel();
            const effectCount = layer.element.children.length;
            const zIndex = sheet.square.style.zIndex;

            expect(effectCount).toBe(0);
            expect(zIndex).toBe("");
          });
        });
      });
    },
  );

  describe("主役の1枚の場合", () => {
    const stamp: ZukanStamp = { level: "good", isRaised: false };
    let motion: ZukanStampMotion | null;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.grid);
      motion = start(stamp, "hero");
    });

    test("着いたら同心円の波紋を2つ広げ、周りの8マスを押し退けること", () => {
      motion?.land(landTimeOf("hero"));
      const rings = [...layer.element.children].filter(
        (element) =>
          element instanceof HTMLElement &&
          element.style.borderRadius === "50%",
      );
      const nudgedSquares = new Set(
        listAnimatedElements().filter(
          (element) =>
            element.hasAttribute("data-index") && element !== sheet.square,
        ),
      );

      expect(rings).toHaveLength(2);
      expect(nudgedSquares.size).toBe(8);
    });
  });

  describe("4枚から10枚のうちの1枚の場合", () => {
    const stamp: ZukanStamp = { level: "good", isRaised: false };
    let motion: ZukanStampMotion | null;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.grid);
      motion = start(stamp, "featured");
    });

    test("着いても台紙も周りのマスも動かさないこと", () => {
      motion?.land(landTimeOf("featured"));
      const movedElements = listAnimatedElements().filter(
        (element) =>
          element === sheet.grid ||
          element === sheet.sheet ||
          (element.hasAttribute("data-index") && element !== sheet.square),
      );

      expect(movedElements).toEqual([]);
    });
  });

  describe("波でまとめてはめる場合", () => {
    const stamp: ZukanStamp = { level: "great", isRaised: false };

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.grid);
    });

    test("押す姿だけを動かし、影を落とさないこと", () => {
      start(stamp, "wave");
      const animated = listAnimatedElements();

      expect(animated).toEqual([sheet.parts.face]);
    });

    test("数えるまでは、はまった姿より淡くしておくこと", () => {
      start(stamp, "wave");
      const opacities = findAnimation(sheet.parts.face)?.keyframes.map(
        ({ opacity }) => Number(opacity),
      );

      expect(opacities?.[1]).toBeLessThan(1);
    });

    describe("押し始めている場合", () => {
      let motion: ZukanStampMotion | null;

      beforeEach(() => {
        motion = start(stamp, "wave");
      });

      test("着いても層に何も描かず、押す姿を薄れさせてマスの普段の姿へ渡すこと", () => {
        motion?.land(landTimeOf("wave"));
        const effectCount = layer.element.children.length;
        const handOff = recorded.findLast(
          ({ element }) => element === sheet.parts.face,
        );

        expect(effectCount).toBe(0);
        expect(handOff?.keyframes.map(({ opacity }) => opacity)).toEqual([
          1, 0,
        ]);
      });
    });
  });

  describe("段階が上がったマスの場合", () => {
    const stamp: ZukanStamp = { level: "great", isRaised: true };

    beforeEach(() => {
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.grid);
    });

    test.each(["hero", "featured", "wave"] as const)(
      "前の色を見せた姿から始め、飛んでいる間に前の色を消して今の色にすること: %s",
      (style) => {
        start(stamp, style);
        const opacities = sheet.parts.previous
          ? findAnimation(sheet.parts.previous)?.keyframes.map(
              ({ opacity }) => opacity,
            )
          : undefined;

        expect(opacities?.[0]).toBe(1);
        expect(opacities?.at(-1)).toBe(0);
      },
    );
  });

  describe("perfect に至ったマスの場合", () => {
    const stamp: ZukanStamp = { level: "perfect", isRaised: true };

    beforeEach(() => {
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.grid);
    });

    test("飛んでいる間、行き先の枠の光に加えて、飛ぶ姿に光を帯びさせること", () => {
      start(stamp, "featured");
      const effectCount = layer.element.children.length;

      expect(effectCount).toBe(2);
    });

    describe("押し始めている場合", () => {
      let motion: ZukanStampMotion | null;

      beforeEach(() => {
        motion = start(stamp, "featured");
      });

      test("着いたら、マスを並べた要素ではなく台紙を沈ませること", () => {
        motion?.land(landTimeOf("featured"));
        const animated = listAnimatedElements();

        expect(animated).toContain(sheet.sheet);
        expect(animated).not.toContain(sheet.grid);
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    const stamp: ZukanStamp = { level: "perfect", isRaised: true };

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.grid);
    });

    test("動かさずに、押し始めなかったとすること", () => {
      const motion = start(stamp, "hero");

      expect(motion).toBeNull();
      expect(recorded).toEqual([]);
    });
  });
});

describe("playZukanNewPieceMarks", () => {
  let layer: ZukanStampEffectLayer;
  let sheet: ReturnType<typeof renderSheet>;

  beforeEach(() => {
    sheet = renderSheet({ isRaised: false });
    layer = createZukanStampEffectLayer(sheet.grid, "new-piece-marks");
  });

  test("はめたピースごとに、輪郭の外の光を何度か脈打たせてから消すこと", () => {
    playZukanNewPieceMarks(layer, [{ square: sheet.square, box }], startTime);
    const marks = [...layer.element.children];
    const opacities = marks[0]
      ? findAnimation(marks[0])?.keyframes.map(({ opacity }) => opacity)
      : undefined;
    const peaks = (opacities ?? []).filter(
      (opacity, order, all) =>
        order > 0 &&
        Number(opacity) > Number(all[order - 1]) &&
        Number(opacity) > Number(all[order + 1] ?? 0),
    );

    expect(marks).toHaveLength(1);
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(opacities?.at(-1)).toBe(0);
  });

  describe("印を付けている場合", () => {
    let cancel: () => void;

    beforeEach(() => {
      cancel = playZukanNewPieceMarks(
        layer,
        [{ square: sheet.square, box }],
        startTime,
      );
    });

    test("消すと、印をすぐ片付けること", () => {
      cancel();
      const markCount = layer.element.children.length;

      expect(markCount).toBe(0);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("印を付けないこと", () => {
      playZukanNewPieceMarks(layer, [{ square: sheet.square, box }], startTime);
      const markCount = layer.element.children.length;

      expect(markCount).toBe(0);
    });
  });
});

describe("createZukanStampEffectLayer", () => {
  let sheet: ReturnType<typeof renderSheet>;

  beforeEach(() => {
    sheet = renderSheet({ isRaised: false });
  });

  test("マスを並べた要素の外の、台紙と一緒にスクロールする要素に重ねること", () => {
    const layer = createZukanStampEffectLayer(sheet.grid);
    const parent = layer.element.parentElement;

    expect(parent).toBe(sheet.sheet);
  });

  test.each([
    ["stamp-effects", "data-zukan-stamp-effects"],
    ["new-piece-marks", "data-zukan-new-piece-marks"],
  ] as const)(
    "役目 %s の層を、%s で見分けられるようにすること",
    (purpose, attribute) => {
      const layer = createZukanStampEffectLayer(sheet.grid, purpose);
      const hasAttribute = layer.element.hasAttribute(attribute);

      expect(hasAttribute).toBe(true);
    },
  );

  describe("効果を描いている場合", () => {
    let layer: ZukanStampEffectLayer;

    beforeEach(() => {
      layer = createZukanStampEffectLayer(sheet.grid);
      layer.element.append(document.createElement("div"));
    });

    test("外すと、描いている効果ごと画面から片付けること", () => {
      layer.remove();
      const remainingLayers = document.querySelectorAll(
        "[data-zukan-stamp-effects]",
      );

      expect(remainingLayers).toHaveLength(0);
    });
  });
});

describe("measureZukanStampSquareBox", () => {
  let layer: ZukanStampEffectLayer;
  let square: HTMLElement;

  beforeEach(() => {
    const sheet = renderSheet({ isRaised: false });
    square = sheet.square;
    layer = createZukanStampEffectLayer(sheet.grid);
    vi.spyOn(layer.element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 200, 300, 300),
    );
    vi.spyOn(square, "getBoundingClientRect").mockReturnValue(
      new DOMRect(130, 260, 30, 30),
    );
  });

  test("マスの中心を層の左上からの位置で、大きさを1辺の長さで測ること", () => {
    const measured = measureZukanStampSquareBox(square, layer);

    expect(measured).toEqual({ x: 45, y: 75, size: 30 });
  });
});
