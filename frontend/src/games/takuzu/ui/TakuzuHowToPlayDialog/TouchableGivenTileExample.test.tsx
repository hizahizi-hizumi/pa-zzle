import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { givenTileStrip } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { TouchableGivenTileExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableGivenTileExample";
import { playSound, type SoundEffect } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

/** タイルの揺れ。動かした要素と、揺れ方・長さを記録する。 */
const animate = vi.fn();

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 例の判定の言葉。図の名前は、見えている判定の言葉と凡例から付く。 */
function readVerdict(): string | null {
  if (screen.queryByRole("figure", { name: /^変えられない/ })) {
    return "変えられない";
  }
  return screen.queryByRole("figure", { name: /^変えられる/ })
    ? "変えられる"
    : null;
}

function readCellNames(): string[] {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((name) => /^\d行\d列/.test(name));
}

/** 押す所の手がかり（破線の枠）が付いているか。手がかりは読み上げない見た目だけの印なので、枠の有無で見る。 */
function hasHint(): boolean {
  return document.querySelector(".border-dashed") !== null;
}

/** 鳴らした音の、音声ファイルの名前。 */
function listPlayedSounds(): (string | undefined)[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(
      ([sound]) => (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
    );
}

describe("TouchableGivenTileExample", () => {
  /** 本番の盤面で、最初からあるタイルを押して通らなかったときの揺れ方と長さ。 */
  let productionShake: unknown[] = [];

  beforeEach(() => {
    animate.mockClear();
    Element.prototype.animate = animate as unknown as Element["animate"];
    render(
      <TakuzuBoard
        size={2}
        cells={[
          { cell: "a", given: true, inViolatingRun: false },
          { cell: null, given: false, inViolatingRun: false },
          { cell: null, given: false, inViolatingRun: false },
          { cell: null, given: false, inViolatingRun: false },
        ]}
        lineViolations={[]}
        operation={{ id: 1, type: "invalid", cellIndex: 0 }}
        interactionDisabled={false}
        onCycleCell={vi.fn()}
        onPlaceCell={vi.fn()}
      />,
    );
    productionShake = animate.mock.calls[0] ?? [];
    cleanup();
    animate.mockClear();
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableGivenTileExample board={givenTileStrip} />
      </HowToPlayExamplePanel>,
    );
  });

  test("触る前は、手がかりを付けた最初からあるタイルを押す手の答え ✕ 変えられない と、色の凡例を添えること", () => {
    const verdict = readVerdict();
    const legend = screen.queryByRole("figure", { name: /最初から ?置いた$/ });

    expect(verdict).toBe("変えられない");
    expect(legend).not.toBeNull();
    expect(hasHint()).toBe(true);
    expect(readCellNames()).toEqual([
      "1行1列 四角 固定",
      "1行2列 四角",
      "1行3列 丸 固定",
    ]);
  });

  test("最初からあるタイルを押すと、本番の盤面と同じ揺れを再生して変わらず、✕ 変えられない のまま手がかりが消えること", () => {
    const given = screen.getByRole("button", { name: "1行1列 四角 固定" });

    fireEvent.click(given);

    expect(productionShake).not.toEqual([]);
    expect(animate.mock.calls).toEqual([productionShake]);
    expect(animate.mock.contexts[0]).toBe(
      given.querySelector("[data-takuzu-tile]"),
    );
    expect(readVerdict()).toBe("変えられない");
    expect(hasHint()).toBe(false);
    expect(readCellNames()[0]).toBe("1行1列 四角 固定");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "例を元に戻す" })
        .disabled,
    ).toBe(false);
  });

  describe("置いたタイルを押した場合", () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole("button", { name: "1行2列 四角" }));
    });

    test("本番と同じ順に変わり、✓ 変えられる に替わること", () => {
      const verdict = readVerdict();

      expect(verdict).toBe("変えられる");
      expect(readCellNames()[1]).toBe("1行2列 丸");
    });

    test("元に戻すと、触る前の姿と手がかりに戻ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

      expect(readVerdict()).toBe("変えられない");
      expect(hasHint()).toBe(true);
      expect(readCellNames()[1]).toBe("1行2列 四角");
    });
  });

  test("最初からあるタイルを押すと本番と同じ通らない音を、置いたタイルを押すと本番と同じ置いた音を鳴らすこと", () => {
    fireEvent.click(screen.getByRole("button", { name: "1行1列 四角 固定" }));
    fireEvent.click(screen.getByRole("button", { name: "1行2列 四角" }));

    const sounds = listPlayedSounds();

    expect(sounds).toEqual(["invalid", "tile-b-placed"]);
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("本番の盤面と同じく、最初からあるタイルを揺らさずに変えないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "1行1列 四角 固定" }));

      expect(animate).not.toHaveBeenCalled();
      expect(readCellNames()[0]).toBe("1行1列 四角 固定");
    });

    test("本番と同じく、画面が何も変わらない最初からあるタイルの操作には音を鳴らさず、置いたタイルの操作には鳴らすこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "1行1列 四角 固定" }));
      fireEvent.click(screen.getByRole("button", { name: "1行2列 四角" }));

      const sounds = listPlayedSounds();

      expect(sounds).toEqual(["tile-b-placed"]);
    });
  });
});
