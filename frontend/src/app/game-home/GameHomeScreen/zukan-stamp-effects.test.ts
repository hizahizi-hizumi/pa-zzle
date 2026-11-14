import type { ZukanStamp } from "@/app/game-home/GameHomeScreen/zukan-change-reveal";
import {
  createZukanStampEffectLayer,
  findZukanStampParts,
  getZukanStampTier,
  playZukanStamp,
  type ZukanStampEffectLayer,
} from "@/app/game-home/GameHomeScreen/zukan-stamp-effects";
import { playZukanStampSound } from "@/app/game-home/GameHomeScreen/zukan-stamp-sound";
import type { GameResultLevel } from "@/games/result";

vi.mock("@/app/game-home/GameHomeScreen/zukan-stamp-sound", () => ({
  playZukanStampSound: vi.fn(),
}));

type RecordedAnimation = {
  element: Element;
  keyframes: Keyframe[];
  finish: () => void;
};

let recorded: RecordedAnimation[];

/** 呼ばれた動きを記録し、`finish` で終えられる Animation を返す。取り消すと終わらない。 */
function recordAnimate(
  this: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
): Animation {
  let resolveFinished: (animation: Animation) => void = () => {};
  let rejectFinished: (reason: unknown) => void = () => {};
  const animation = {
    finished: new Promise<Animation>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    }),
    cancel: vi.fn(() => rejectFinished(new DOMException("", "AbortError"))),
  } as unknown as Animation;
  animation.finished.catch(() => {});
  recorded.push({
    element: this,
    keyframes: keyframes as Keyframe[],
    finish: () => resolveFinished(animation),
  });
  return animation;
}

async function flushPromises() {
  await vi.advanceTimersByTimeAsync(0);
}

async function land(face: Element) {
  for (const animation of recorded.filter(({ element }) => element === face)) {
    animation.finish();
  }
  await flushPromises();
}

const columnCount = 3;

/**
 * 3列3行の台紙を作り、真ん中のマスを変化したマスにする。
 * 状態ごとの数の並びも置き、押したときに数を弾ませられるようにする。
 */
function renderSheet({ isRaised }: { isRaised: boolean }) {
  document.body.innerHTML = `
    <ul aria-label="状態ごとの問題の数">
      <li>perfect</li><li>great</li><li>good</li><li>clear</li><li>挑戦中</li><li>未挑戦</li>
    </ul>
    <div data-testid="scroller">
      <div data-testid="grid" style="grid-template-columns: 1fr 1fr 1fr">
        ${Array.from(
          { length: columnCount * 3 },
          (_, index) =>
            `<button data-index="${index}" ${index === 4 ? 'data-change-stage="stamping"' : ""}>${
              index === 4
                ? `<span data-stamp-part="face">${isRaised ? '<span data-stamp-part="previous"></span>' : ""}<span data-stamp-part="shadow"></span></span>`
                : ""
            }</button>`,
        ).join("")}
      </div>
    </div>`;
  const scroller = document.querySelector<HTMLElement>(
    '[data-testid="scroller"]',
  );
  const grid = document.querySelector('[data-testid="grid"]');
  const square = document.querySelector('[data-index="4"]');
  const parts = square ? findZukanStampParts(square) : null;
  if (!scroller || !grid || !square || !parts) {
    throw new Error("台紙を作れない");
  }
  return { scroller, grid, square, parts };
}

function listAnimatedElements(): Element[] {
  return recorded.map(({ element }) => element);
}

beforeEach(() => {
  vi.useFakeTimers();
  recorded = [];
  Element.prototype.animate = recordAnimate as Element["animate"];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(playZukanStampSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
  document.body.innerHTML = "";
});

describe("getZukanStampTier", () => {
  const levels: GameResultLevel[] = ["clear", "good", "great", "perfect"];

  test("段階が高いほど、大きく浮かせて大きな衝撃波を広げること", () => {
    const tiers = levels.map(getZukanStampTier);
    const isStronger = tiers.every(
      (tier, index) =>
        index === 0 ||
        (tier.liftedScale > (tiers[index - 1]?.liftedScale ?? 0) &&
          tier.shockwaveScale > (tiers[index - 1]?.shockwaveScale ?? 0)),
    );

    expect(isStronger).toBe(true);
  });

  test("粒と光は great から付け、perfect で最も多くすること", () => {
    const tiers = levels.map(getZukanStampTier);
    const particles = tiers.map(({ particleCount }) => particleCount);
    const flashes = tiers.map(({ flashesOnLanding }) => flashesOnLanding);

    expect(particles[0]).toBe(0);
    expect(particles[1]).toBe(0);
    expect(particles[3]).toBeGreaterThan(particles[2] ?? 0);
    expect(flashes).toEqual([false, false, true, true]);
  });

  test("perfect だけを特別に強く見せること", () => {
    const finest = levels.filter((level) => getZukanStampTier(level).isFinest);

    expect(finest).toEqual(["perfect"]);
  });
});

describe("playZukanStamp", () => {
  let layer: ZukanStampEffectLayer;
  let onLanded: ReturnType<typeof vi.fn<() => void>>;
  let onFinished: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onLanded = vi.fn<() => void>();
    onFinished = vi.fn<() => void>();
  });

  describe("新しく clear で解いたマスの場合", () => {
    const stamp: ZukanStamp = { level: "clear", isRaised: false };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("押す姿の動きが終わるまでは、マスに着いたことを知らせず音も鳴らさないこと", async () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      await flushPromises();

      expect(onLanded).not.toHaveBeenCalled();
      expect(playZukanStampSound).not.toHaveBeenCalled();
    });

    test("押す姿が着くと、着いたことを知らせて音を鳴らし、余韻が消えると終わったことを知らせること", async () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      await land(sheet.parts.face);
      const finishedOnLanding = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);

      expect(onLanded).toHaveBeenCalledTimes(1);
      expect(playZukanStampSound).toHaveBeenCalledWith(stamp);
      expect(finishedOnLanding).toBe(0);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    test("台紙を揺らさず、周りのマスも押し退けないこと", async () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      await land(sheet.parts.face);
      const animatedSquares = listAnimatedElements().filter(
        (element) =>
          element === sheet.grid ||
          (element.hasAttribute("data-index") && element !== sheet.square),
      );

      expect(animatedSquares).toEqual([]);
    });
  });

  describe("音を鳴らさないマスの場合", () => {
    const stamp: ZukanStamp = { level: "great", isRaised: false };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("着いても音を鳴らさないこと", async () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: false, onLanded, onFinished },
      );
      await land(sheet.parts.face);

      expect(onLanded).toHaveBeenCalledTimes(1);
      expect(playZukanStampSound).not.toHaveBeenCalled();
    });
  });

  describe("段階が上がったマスの場合", () => {
    const stamp: ZukanStamp = { level: "great", isRaised: true };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("前の色を見せた姿から始め、落ちながら前の色を消して今の色にすること", () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      const previousFade = recorded.find(
        ({ element }) => element === sheet.parts.previous,
      );
      const opacities = previousFade?.keyframes.map(({ opacity }) => opacity);

      expect(opacities?.[0]).toBe(1);
      expect(opacities?.at(-1)).toBe(0);
    });
  });

  describe("perfect に至ったマスの場合", () => {
    const stamp: ZukanStamp = { level: "perfect", isRaised: true };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("浮いている間から、台紙の外に重ねた層に光を帯びさせること", () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      const glowCount = layer.element.children.length;

      expect(glowCount).toBe(1);
    });

    test("着いたら台紙を揺らし、周りの8マスを押し退けること", async () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      await land(sheet.parts.face);
      const animated = listAnimatedElements();
      const nudgedSquares = new Set(
        animated.filter(
          (element) =>
            element.hasAttribute("data-index") && element !== sheet.square,
        ),
      );

      expect(animated).toContain(sheet.grid);
      expect(nudgedSquares.size).toBe(8);
    });
  });

  describe("取り消した場合", () => {
    const stamp: ZukanStamp = { level: "perfect", isRaised: false };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      sheet = renderSheet({ isRaised: false });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("層に描いた効果を片付け、着いたことも終わったことも知らせず音も鳴らさないこと", async () => {
      const cancel = playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );
      cancel();
      await land(sheet.parts.face);
      await vi.advanceTimersByTimeAsync(1000);

      expect(layer.element.children.length).toBe(0);
      expect(onLanded).not.toHaveBeenCalled();
      expect(onFinished).not.toHaveBeenCalled();
      expect(playZukanStampSound).not.toHaveBeenCalled();
    });
  });

  describe("動きを減らす設定の場合", () => {
    const stamp: ZukanStamp = { level: "perfect", isRaised: true };
    let sheet: ReturnType<typeof renderSheet>;

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      sheet = renderSheet({ isRaised: true });
      layer = createZukanStampEffectLayer(sheet.scroller);
    });

    test("動かさず鳴らさずに、すぐにマスに着いて終わったことを知らせること", () => {
      playZukanStamp(
        { ...sheet, stamp },
        { layer, playsSound: true, onLanded, onFinished },
      );

      expect(recorded).toEqual([]);
      expect(playZukanStampSound).not.toHaveBeenCalled();
      expect(onLanded).toHaveBeenCalledTimes(1);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });
});

describe("createZukanStampEffectLayer", () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    scroller = renderSheet({ isRaised: false }).scroller;
  });

  test("台紙をスクロールした分だけ層を動かし、描いた効果をマスから離さないこと", () => {
    const layer = createZukanStampEffectLayer(scroller);
    scroller.scrollTop = 40;
    scroller.dispatchEvent(new Event("scroll"));

    expect(layer.element.style.transform).toBe("translateY(-40px)");
    expect(layer.toLayerY(100)).toBe(140);
  });

  describe("効果を描いている場合", () => {
    let layer: ZukanStampEffectLayer;

    beforeEach(() => {
      layer = createZukanStampEffectLayer(scroller);
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
