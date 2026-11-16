import { cleanup, render } from "@testing-library/react";

import {
  CLEAR_START_DELAY_MS,
  CLEAR_WAVE_STAGGER_MS,
} from "@/games/tsume-shogi/ui/board/clear/clear-wave";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";

type AnimateCall = { target: Element; delay: number | undefined };

let calls: AnimateCall[];

beforeEach(() => {
  calls = [];
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value(this: Element, _: Keyframe[], options: KeyframeAnimationOptions) {
      calls.push({ target: this, delay: Number(options.delay) });
      return { finished: new Promise(() => {}), cancel() {} };
    },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 玉は 2三、2三から2升離れた 4三に駒、駒の無い 5三。 */
function Squares() {
  return (
    <div data-board-squares="">
      <button type="button" data-file={2} data-rank={3} data-mated-king="">
        <span data-clear-glow="" />
        <span data-piece="" data-testid="king" />
      </button>
      <button type="button" data-file={4} data-rank={3}>
        <span data-clear-glow="" />
        <span data-piece="" data-testid="gold" />
      </button>
      <button type="button" data-file={5} data-rank={3}>
        <span data-clear-glow="" data-testid="empty-glow" />
      </button>
    </div>
  );
}

describe("TsumeShogiClearAnimation", () => {
  describe("詰んだ盤で演出が始まった場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <TsumeShogiClearAnimation active onClearAnimationComplete={vi.fn()}>
          <Squares />
        </TsumeShogiClearAnimation>,
      ));
    });

    test("玉の升から距離に応じて照りを広げ、駒は動かさないこと", () => {
      const delays = Object.fromEntries(
        calls.map(({ target, delay }) => [
          `${(target.closest("button") as HTMLElement).dataset.file}-glow`,
          delay,
        ]),
      );

      expect(delays).toEqual({
        "2-glow": CLEAR_START_DELAY_MS,
        "4-glow": CLEAR_START_DELAY_MS + 2 * CLEAR_WAVE_STAGGER_MS,
        "5-glow": CLEAR_START_DELAY_MS + 3 * CLEAR_WAVE_STAGGER_MS,
      });
      expect(
        calls.every(({ target }) => target.hasAttribute("data-clear-glow")),
      ).toBe(true);
      expect(container.querySelector("[data-board-squares]")).not.toBeNull();
    });
  });
});
