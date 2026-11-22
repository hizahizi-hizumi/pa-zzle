import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  zukanPieceReturnCarrier,
  zukanPieceSettleCarrier,
  zukanPieceStowCarrier,
} from "@/app/shell/zukan-piece-transit";
import { registerZukanResultPieceFrontAligner } from "@/features/zukan/ui/zukan-result-piece-pose";

const RESULT_HTML = `
  <span data-result-emblem="">
    <svg data-zukan-result-piece="" viewBox="-0.5 -0.5 2 2"><path d="M0,0 Z" /></svg>
  </span>
`;

function stubAnimate() {
  const animate = vi.fn((_keyframes: Keyframe[]) => ({
    finished: Promise.resolve(),
    cancel: vi.fn(),
  }));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  return animate;
}

function carriedPiece(): Element | null {
  return document.querySelector("[data-zukan-carried-piece]");
}

function resultEmblem(): HTMLElement {
  return document.querySelector("[data-result-emblem]") as HTMLElement;
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "animate");
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
});

describe("zukanPieceSettleCarrier", () => {
  describe("結果にピースが添えられている場合", () => {
    beforeEach(() => {
      document.body.innerHTML = RESULT_HTML;
    });

    test("解いた画面を絞る先として、ピースの形を渡すこと", () => {
      zukanPieceSettleCarrier.after?.();
      const mask = document.documentElement.style.getPropertyValue(
        "--screen-piece-mask",
      );

      expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    });
  });

  describe("結果にピースが添えられていない場合", () => {
    beforeEach(() => {
      document.documentElement.style.setProperty(
        "--screen-piece-mask",
        'url("data:,")',
      );
    });

    test("前の結果で渡したピースの形を残さないこと", () => {
      zukanPieceSettleCarrier.after?.();
      const mask = document.documentElement.style.getPropertyValue(
        "--screen-piece-mask",
      );

      expect(mask).toBe("");
    });
  });
});

describe("zukanPieceReturnCarrier", () => {
  describe("ピースを動かせる場合", () => {
    beforeEach(() => {
      stubAnimate();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      document.body.innerHTML = RESULT_HTML;
    });

    test("行き来の前に、結果のピースを運べる層へ写して、結果のピースを隠すこと", () => {
      zukanPieceReturnCarrier.before?.();
      const emblemVisibility = resultEmblem().style.visibility;

      expect(carriedPiece()).not.toBeNull();
      expect(emblemVisibility).toBe("hidden");
    });

    describe("戻った先に元のマスが無い場合", () => {
      beforeEach(() => {
        zukanPieceReturnCarrier.before?.();
        document.querySelector("[data-result-emblem]")?.remove();
      });

      test("運んだピースを消すこと", async () => {
        await zukanPieceReturnCarrier.after?.();

        expect(carriedPiece()).toBeNull();
      });
    });

    describe("戻った先の元のマスがまだ描かれていない場合", () => {
      const squareDrawWaitMs = 900;
      let landing: Promise<"landed" | "waiting">;

      beforeEach(() => {
        zukanPieceReturnCarrier.before?.();
        landing = Promise.resolve(zukanPieceReturnCarrier.after?.()).then(
          () => "landed" as const,
        );
      });

      test("飛ばされたら、マスが描かれるのを待たずに運ぶ動きを終えること", async () => {
        zukanPieceReturnCarrier.skip?.();
        const outcome = await Promise.race([
          landing,
          new Promise<"waiting">((resolve) =>
            setTimeout(() => resolve("waiting"), squareDrawWaitMs / 3),
          ),
        ]);

        expect(outcome).toBe("landed");
        expect(carriedPiece()).toBeNull();
      });
    });

    describe("元のマスが、前回からの変化で押されるのを待っている場合", () => {
      beforeEach(() => {
        zukanPieceReturnCarrier.before?.();
        document.body.insertAdjacentHTML(
          "beforeend",
          '<button type="button" data-piece-shape="0,1,-1,0" aria-current="true" data-change-stage="waiting"><svg></svg></button>',
        );
      });

      test("運んだピースを置いておくこと", async () => {
        await zukanPieceReturnCarrier.after?.();

        expect(carriedPiece()).not.toBeNull();
      });

      test("飛ばされたら、運んだピースを取り除くこと", async () => {
        await zukanPieceReturnCarrier.after?.();
        zukanPieceReturnCarrier.skip?.();

        expect(carriedPiece()).toBeNull();
      });
    });

    describe("元のマスの色が変わらない場合", () => {
      beforeEach(() => {
        zukanPieceReturnCarrier.before?.();
        document.body.insertAdjacentHTML(
          "beforeend",
          '<button type="button" data-piece-shape="0,1,-1,0" aria-current="true"><svg></svg></button>',
        );
      });

      test("はめたピースをすぐマスへ替えること", async () => {
        await zukanPieceReturnCarrier.after?.();
        await vi.waitFor(() => expect(carriedPiece()).toBeNull());

        expect(carriedPiece()).toBeNull();
      });
    });
  });

  describe("結果のピースを立体で回している場合", () => {
    const order: string[] = [];
    let unregister: () => void;

    beforeEach(() => {
      stubAnimate();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      document.body.innerHTML = RESULT_HTML;
      order.length = 0;
      unregister = registerZukanResultPieceFrontAligner(async () => {
        order.push(carriedPiece() === null ? "aligned" : "aligned-after-lift");
      });
    });

    afterEach(() => {
      unregister();
      zukanPieceReturnCarrier.skip?.();
    });

    test("正面を向いた姿へ揃えてから、ピースを写すこと", async () => {
      await zukanPieceReturnCarrier.before?.();

      expect(order).toEqual(["aligned"]);
      expect(carriedPiece()).not.toBeNull();
    });

    describe("正面へ揃えている間に飛ばされた場合", () => {
      let finishAligning: () => void;
      let lifting: Promise<void> | void;

      beforeEach(() => {
        unregister();
        unregister = registerZukanResultPieceFrontAligner(
          () =>
            new Promise<void>((resolve) => {
              finishAligning = resolve;
            }),
        );
        lifting = zukanPieceReturnCarrier.before?.();
      });

      test("揃え終えても、ピースを写さずに終えること", async () => {
        zukanPieceReturnCarrier.skip?.();
        finishAligning();
        await lifting;
        const emblemVisibility = resultEmblem().style.visibility;

        expect(carriedPiece()).toBeNull();
        expect(emblemVisibility).toBe("");
      });
    });
  });

  describe("ピースを動かせない場合", () => {
    beforeEach(() => {
      document.body.innerHTML = RESULT_HTML;
    });

    test("結果のピースをそのままにすること", () => {
      zukanPieceReturnCarrier.before?.();
      const emblemVisibility = resultEmblem().style.visibility;

      expect(carriedPiece()).toBeNull();
      expect(emblemVisibility).toBe("");
    });
  });
});

describe("zukanPieceStowCarrier", () => {
  const iconRect = { left: 100, top: 200, width: 20, height: 20 };
  let animate: ReturnType<typeof stubAnimate>;

  beforeEach(() => {
    animate = stubAnimate();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    document.body.innerHTML = `${RESULT_HTML}<button type="button" data-result-collection=""><svg data-collection-icon=""></svg>問題選択</button>`;
    const icon = document.querySelector("[data-collection-icon]") as Element;
    vi.spyOn(icon, "getBoundingClientRect").mockReturnValue(
      iconRect as DOMRect,
    );
  });

  test("次のプレイへ進む前に、結果のピースを「問題選択」へしまい終えて、運んだ層を残さないこと", async () => {
    await zukanPieceStowCarrier.before?.();
    const emblemVisibility = resultEmblem().style.visibility;

    expect(animate).toHaveBeenCalledOnce();
    expect(carriedPiece()).toBeNull();
    expect(emblemVisibility).toBe("hidden");
  });

  test("ピースを「問題選択」のアイコンの中心へ動かすこと", async () => {
    await zukanPieceStowCarrier.before?.();
    const keyframes = animate.mock.calls[0]?.[0];

    expect(keyframes?.at(-1)?.transform).toBe(
      "translate(110px, 210px) scale(0.3)",
    );
  });
});
