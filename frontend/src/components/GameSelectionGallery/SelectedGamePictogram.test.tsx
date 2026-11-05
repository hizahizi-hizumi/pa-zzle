import { act, cleanup, render } from "@testing-library/react";

import { SelectedGamePictogram } from "@/components/GameSelectionGallery/SelectedGamePictogram";

const monoSvg = '<svg viewBox="0 0 120 120" data-game="mono" />';
const showcaseSvg = '<svg viewBox="0 0 120 120" data-game="showcase" />';

function motionOf(container: HTMLElement): string | null {
  return (
    container
      .querySelector('svg[data-game="showcase"]')
      ?.parentElement?.getAttribute("data-pictogram-motion") ?? null
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelectedGamePictogram", () => {
  describe("色を入れずに描く場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <SelectedGamePictogram
          pictogramSvg={monoSvg}
          pictogramShowcaseSvg={showcaseSvg}
          size="hero"
          motion="play"
          colorsIn={false}
        />,
      ));
    });

    test("色と動きのある姿だけを動かして見せること", () => {
      const mono = container.querySelector('svg[data-game="mono"]');

      expect([mono, motionOf(container)]).toEqual([null, "play"]);
    });
  });

  describe("選んだ直後として描く場合", () => {
    let container: HTMLElement;
    let finish: () => void;

    beforeEach(() => {
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      // jsdom は Web Animations API を持たないので、終わりを外から決められる動きを置く。
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: () => ({ finished, cancel: vi.fn() }),
      });
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
      ({ container } = render(
        <SelectedGamePictogram
          pictogramSvg={monoSvg}
          pictogramShowcaseSvg={showcaseSvg}
          size="hero"
          motion="play"
          colorsIn
        />,
      ));
    });

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
      vi.unstubAllGlobals();
    });

    test("色が入りきるまでは濃淡2色の姿を重ね、動かさないこと", () => {
      const mono = container.querySelector('svg[data-game="mono"]');

      expect([mono !== null, motionOf(container)]).toEqual([true, null]);
    });

    test("色が入りきったら濃淡2色の姿を外し、動かし始めること", async () => {
      await act(async () => {
        finish();
      });

      const mono = container.querySelector('svg[data-game="mono"]');
      expect([mono, motionOf(container)]).toEqual([null, "play"]);
    });
  });

  describe("色と動きのある姿を持たない場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <SelectedGamePictogram pictogramSvg={monoSvg} size="list" colorsIn />,
      ));
    });

    test("濃淡2色の姿を見せること", () => {
      const mono = container.querySelector('svg[data-game="mono"]');

      expect(mono).not.toBeNull();
    });
  });
});
