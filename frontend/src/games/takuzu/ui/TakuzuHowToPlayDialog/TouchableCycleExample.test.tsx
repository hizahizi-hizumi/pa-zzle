import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  backwardCycleFigures,
  backwardCycleTouchBoard,
  cycleFigures,
  cycleTouchBoard,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { TouchableCycleExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableCycleExample";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
});

function readCycleDescription(): string | null {
  return screen
    .getByRole("img", { name: /の順に変わる/ })
    .getAttribute("aria-label");
}

function getResetButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

describe("TouchableCycleExample", () => {
  describe("押すたびに巡る例の場合", () => {
    beforeEach(() => {
      render(
        <HowToPlayExamplePanel resettable>
          <TouchableCycleExample cycle={cycleFigures} board={cycleTouchBoard} />
        </HowToPlayExamplePanel>,
      );
    });

    test("巡る順と、最後から最初へ戻ることと、今の姿を伝えること", () => {
      const description = readCycleDescription();

      expect(description).toBe(
        "空き、四角、丸の順に変わる。丸の次は空きに戻る。今は空き",
      );
    });

    test("マスを押すたびに本番の順で変わり、巡る順の図の今の姿もそれに合わせて替わること", () => {
      const currents: (string | undefined)[] = [];
      for (const name of [/^1行1列 空き/, /^1行1列 四角/, /^1行1列 丸/]) {
        fireEvent.click(screen.getByRole("button", { name }));
        currents.push(readCycleDescription()?.split("。").at(-1));
      }

      expect(currents).toEqual(["今は四角", "今は丸", "今は空き"]);
    });

    test("触る前は、マスに押す所の手がかりを付け、元に戻すボタンを使えなくしておくこと", () => {
      const cell = screen.getByRole("button", { name: /^1行1列/ });
      const reset = getResetButton();

      expect(cell.getAttribute("aria-label")).toBe("1行1列 空き 押すと四角");
      expect(reset.disabled).toBe(true);
    });

    test("マスを押すたびに、本番と同じ置いた音と空きにした音を、回数の多い操作の揺らぎを付けて鳴らすこと", () => {
      for (const name of [/^1行1列 空き/, /^1行1列 四角/, /^1行1列 丸/]) {
        fireEvent.click(screen.getByRole("button", { name }));
      }

      const sounds = vi
        .mocked(playSound)
        .mock.calls.map(([sound, options]) => ({
          name: (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
          variation: options?.variation,
        }));

      expect(sounds).toEqual(
        ["tile-a-placed", "tile-b-placed", "emptied"].map((name) => ({
          name,
          variation: REPEATED_SOUND_VARIATION,
        })),
      );
    });

    describe("押して最初の姿から変えた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: /^1行1列 空き/ }));
        fireEvent.click(screen.getByRole("button", { name: /^1行1列 四角/ }));
      });

      test("元に戻すボタンが使えること", () => {
        const reset = getResetButton();

        expect(reset.disabled).toBe(false);
      });

      test("元に戻すと、最初の空きのマスと手がかりに戻ること", () => {
        fireEvent.click(getResetButton());

        expect(
          screen
            .getByRole("button", { name: /^1行1列/ })
            .getAttribute("aria-label"),
        ).toBe("1行1列 空き 押すと四角");
        expect(readCycleDescription()?.split("。").at(-1)).toBe("今は空き");
      });
    });
  });

  describe("右クリックで巡る例の場合", () => {
    beforeEach(() => {
      render(
        <HowToPlayExamplePanel resettable>
          <TouchableCycleExample
            cycle={backwardCycleFigures}
            board={backwardCycleTouchBoard}
          />
        </HowToPlayExamplePanel>,
      );
    });

    test("右クリックで巡る逆の順と、今の姿を伝え、マスに右クリックでなるタイルを示すこと", () => {
      const description = readCycleDescription();
      const cell = screen.getByRole("button", { name: /^1行1列/ });

      expect(description).toBe(
        "右クリックでは丸、四角、空きの順に変わる。空きの次は丸に戻る。今は空き",
      );
      expect(cell.getAttribute("aria-label")).toBe("1行1列 空き 押すと丸");
    });

    test("マウスで右クリックすると本番と同じく逆の順に変わり、図の今の姿と手がかりもそれに合わせること", () => {
      const cell = screen.getByRole("button", { name: /^1行1列/ });

      fireEvent.pointerDown(cell, { pointerType: "mouse" });
      fireEvent.contextMenu(cell);

      expect(readCycleDescription()?.split("。").at(-1)).toBe("今は丸");
      expect(
        screen
          .getByRole("button", { name: /^1行1列/ })
          .getAttribute("aria-label"),
      ).toBe("1行1列 丸");
    });
  });
});
