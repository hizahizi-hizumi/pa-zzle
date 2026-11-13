import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  zukanPieceReturnCarrier,
  zukanPieceSettleCarrier,
} from "@/zukan/ui/zukan-piece-transit";

const RESULT_HTML = `
  <span data-result-emblem="">
    <svg data-zukan-result-piece="" viewBox="-0.5 -0.5 2 2"><path d="M0,0 Z" /></svg>
  </span>
`;

function stubAnimate() {
  const animate = vi.fn(() => ({
    finished: Promise.resolve(),
    cancel: vi.fn(),
  }));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
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

    test("戻った先に元のマスが無ければ、運んだピースを消すこと", async () => {
      zukanPieceReturnCarrier.before?.();
      document.querySelector("[data-result-emblem]")?.remove();

      await zukanPieceReturnCarrier.after?.();

      expect(carriedPiece()).toBeNull();
    });

    test("元のマスがこれから色を入れるのを待っている間は、運んだピースを置いておくこと", async () => {
      zukanPieceReturnCarrier.before?.();
      document.body.insertAdjacentHTML(
        "beforeend",
        '<button type="button" data-piece-shape="0,1,-1,0" aria-current="true" data-change-stage="waiting"><svg></svg></button>',
      );

      await zukanPieceReturnCarrier.after?.();

      expect(carriedPiece()).not.toBeNull();
    });

    test("元のマスの色が変わらないときは、はめたピースをすぐマスへ替えること", async () => {
      zukanPieceReturnCarrier.before?.();
      document.body.insertAdjacentHTML(
        "beforeend",
        '<button type="button" data-piece-shape="0,1,-1,0" aria-current="true"><svg></svg></button>',
      );

      await zukanPieceReturnCarrier.after?.();
      await vi.waitFor(() => expect(carriedPiece()).toBeNull());

      expect(carriedPiece()).toBeNull();
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
