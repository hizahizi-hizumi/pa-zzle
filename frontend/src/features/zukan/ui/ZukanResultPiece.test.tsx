import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ZukanResultPiece } from "@/features/zukan/ui/ZukanResultPiece";
import { alignZukanResultPieceToFront } from "@/features/zukan/ui/zukan-result-piece-pose";

const scene = {
  render: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};
const createZukanPieceScene = vi.fn<() => typeof scene | null>();

vi.mock("@/features/zukan/ui/zukan-piece-scene", () => ({
  createZukanPieceScene: (...args: unknown[]) =>
    createZukanPieceScene(...(args as [])),
}));

/** 動きを減らす設定を `reduced` にする。戻り値は、設定を変えて変化を知らせる関数。 */
function stubReducedMotion(reduced: boolean): (next: boolean) => void {
  let matches = reduced;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    })),
  );
  return function change(next: boolean) {
    matches = next;
    for (const listener of listeners) listener();
  };
}

function flatPiece(): SVGSVGElement | null {
  return document.querySelector("[data-zukan-result-piece]");
}

function model(): HTMLCanvasElement | null {
  return document.querySelector("canvas[data-zukan-piece-model]");
}

/** 立体の場面の読み込みと、画面の行き来・結果の演出の終わりを待つ。 */
async function settle() {
  await act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  createZukanPieceScene.mockReset();
  scene.dispose.mockReset();
});

describe("ZukanResultPiece", () => {
  describe("ブラウザが WebGL を持たない場合", () => {
    beforeEach(async () => {
      stubReducedMotion(false);
      createZukanPieceScene.mockReturnValue(scene);
      render(<ZukanResultPiece sheetPlace={null} />);
      await settle();
    });

    test("立体を作らず、平面のピースを見せること", () => {
      expect(createZukanPieceScene).not.toHaveBeenCalled();
      expect(flatPiece()?.style.visibility).toBe("");
      expect(model()).toBeNull();
    });
  });

  describe("WebGL の文脈を作れない場合", () => {
    beforeEach(async () => {
      stubReducedMotion(false);
      vi.stubGlobal("WebGLRenderingContext", class {});
      createZukanPieceScene.mockReturnValue(null);
      render(<ZukanResultPiece sheetPlace={null} />);
      await settle();
    });

    test("平面のピースを見せ、立体を描かないこと", () => {
      expect(flatPiece()?.style.visibility).toBe("");
      expect(model()).toBeNull();
      expect(alignZukanResultPieceToFront()).toBeNull();
    });
  });

  describe("立体で描ける場合", () => {
    let unmount: () => void;

    beforeEach(async () => {
      stubReducedMotion(false);
      vi.stubGlobal("WebGLRenderingContext", class {});
      createZukanPieceScene.mockReturnValue(scene);
      ({ unmount } = render(<ZukanResultPiece sheetPlace={null} />));
      await settle();
    });

    test("平面のピースを隠して、立体に替えること", () => {
      expect(model()?.style.visibility).toBe("visible");
      expect(flatPiece()?.style.visibility).toBe("hidden");
    });

    test("外すと、立体の場面を手放して描画を取り除くこと", () => {
      unmount();

      expect(scene.dispose).toHaveBeenCalledOnce();
      expect(model()).toBeNull();
      expect(alignZukanResultPieceToFront()).toBeNull();
    });

    describe("正面へ揃えている途中でタブが隠れた場合", () => {
      let aligning: Promise<void> | null;

      beforeEach(() => {
        // 揃える動きを進めず、隠れたことだけで揃え終えるかを見る。
        vi.stubGlobal(
          "requestAnimationFrame",
          vi.fn(() => 1),
        );
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        aligning = alignZukanResultPieceToFront();
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      test("揃え終えた扱いになり、平面のピースを見せること", async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await aligning;

        expect(flatPiece()?.style.visibility).toBe("");
        expect(model()?.style.visibility).toBe("hidden");
        expect(alignZukanResultPieceToFront()).toBeNull();
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    let changeReducedMotion: (next: boolean) => void;

    beforeEach(async () => {
      changeReducedMotion = stubReducedMotion(true);
      vi.stubGlobal("WebGLRenderingContext", class {});
      createZukanPieceScene.mockReturnValue(scene);
      render(<ZukanResultPiece sheetPlace={null} />);
      await settle();
    });

    test("立体を作らず、平面のピースのまま止めておくこと", () => {
      expect(createZukanPieceScene).not.toHaveBeenCalled();
      expect(flatPiece()?.style.visibility).toBe("");
      expect(model()).toBeNull();
    });

    test("設定を外すと、立体を作って立体に替えること", async () => {
      act(() => changeReducedMotion(false));
      await settle();

      expect(createZukanPieceScene).toHaveBeenCalledOnce();
      expect(model()?.style.visibility).toBe("visible");
      expect(flatPiece()?.style.visibility).toBe("hidden");
    });
  });
});
