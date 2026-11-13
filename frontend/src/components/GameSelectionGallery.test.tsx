import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import {
  type GameSelectionContinuation,
  GameSelectionGallery,
} from "@/components/GameSelectionGallery";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
  playSound: vi.fn(),
}));

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="water-sort" />',
    pictogramShowcaseSvg:
      '<svg viewBox="0 0 120 120" data-game="water-showcase" />',
    to: "/puzzles/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="nanpure" />',
    to: "/puzzles/nanpure",
  },
  {
    name: "マインスイーパー",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="minesweeper" />',
    to: "/puzzles/minesweeper",
  },
] as const;
const onSelect = vi.fn();
const scrollTo = vi.fn();

beforeAll(() => {
  HTMLElement.prototype.scrollTo = scrollTo;
});
afterEach(() => {
  cleanup();
  scrollTo.mockClear();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  onSelect.mockClear();
  window.localStorage.clear();
});

function renderGallery(
  selectedIndex = 0,
  continuation: GameSelectionContinuation | null = null,
  isCovered = false,
) {
  return render(
    <MemoryRouter>
      <GameSelectionGallery
        games={games}
        recordsTo="/records"
        selectedIndex={selectedIndex}
        continuation={continuation}
        onSelect={onSelect}
        isCovered={isCovered}
      />
    </MemoryRouter>,
  );
}

function getCarousel() {
  const carousel = screen.getByRole("group", {
    name: "左右にスライドしてパズルを切り替え",
  });
  Object.defineProperty(carousel, "clientWidth", {
    configurable: true,
    value: 390,
  });
  for (const [position, item] of Array.from(carousel.children).entries()) {
    Object.defineProperty(item, "offsetLeft", {
      configurable: true,
      value: 75 + position * 240,
    });
    Object.defineProperty(item, "offsetWidth", {
      configurable: true,
      value: 240,
    });
  }
  return carousel;
}

function scrollToSlide(index: number, settle = true) {
  const carousel = getCarousel();
  carousel.scrollLeft = index * 240;
  fireEvent.scroll(carousel);
  if (settle) fireEvent(carousel, new Event("scrollend", { bubbles: true }));
}

describe("パズルの選択", () => {
  beforeEach(() => renderGallery());

  test("左右が連続するよう全候補を3周並べ、比較画面や小さな一覧を出さないこと", () => {
    const carousel = getCarousel();
    expect(
      within(carousel).getAllByRole("link", { hidden: true }),
    ).toHaveLength(games.length * 3);
    expect(
      screen.queryByRole("navigation", { name: "デザイン案の比較" }),
    ).toBeNull();
    expect(screen.queryByRole("navigation", { name: "パズル一覧" })).toBeNull();
  });

  test("中央の候補は選択確定の待機なしで開けること", () => {
    scrollToSlide(4, false);
    const current = screen.getByRole("link", { name: "ナンプレを開く" });
    expect(current.getAttribute("href")).toBe("/puzzles/nanpure");
    fireEvent.click(current);
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.playStartSound,
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("隣の候補のタップは中央へ移動させ、スクロール停止後に選択を保存すること", () => {
    fireEvent.click(
      screen.getAllByRole("link", { name: "ナンプレを選択", hidden: true })[1]!,
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "ウォーターソートを開く" }),
    ).toBeTruthy();
    scrollToSlide(4);
    expect(screen.getByRole("link", { name: "ナンプレを開く" })).toBeTruthy();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.carouselMoveSound,
      { variation: { pitchCents: 30, volumeRatio: 0.12 }, volume: 0.48 },
    );
  });

  test("スクロール中の表示は即時更新し、確定音は停止まで鳴らさないこと", () => {
    scrollToSlide(5, false);
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
    expect(screen.getAllByText("03").length).toBeGreaterThan(0);
    expect(onSelect).not.toHaveBeenCalled();
    scrollToSlide(5);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
  });

  test("最後から最初へスライドし、中央の周へ継ぎ目なく戻ること", () => {
    cleanup();
    renderGallery(2);
    getCarousel();
    scrollToSlide(6);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(0);
    expect(
      within(
        screen.getByRole("link", { name: "ウォーターソートを開く" }),
      ).getByText("01"),
    ).toBeTruthy();
    expect(getCarousel().scrollLeft).toBe(720);
  });

  test("最初から最後へ逆方向にも循環できること", () => {
    scrollToSlide(2);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getAllByText("03").length).toBeGreaterThan(0);
    expect(getCarousel().scrollLeft).toBe(1200);
  });

  test.each([1, -1])(
    "停止を待たずに一方向へ何周もスクロールしても端で止まらないこと: %i",
    (direction) => {
      const carousel = getCarousel();
      carousel.scrollLeft = games.length * 240;
      fireEvent.pointerDown(carousel, { pointerType: "touch", pointerId: 1 });
      const visited: number[] = [];
      for (let lap = 0; lap < 12; lap++) {
        for (let index = 0; index < games.length; index++) {
          fireEvent.pointerDown(carousel, {
            pointerType: "touch",
            pointerId: lap * games.length + index + 2,
          });
          carousel.scrollLeft += direction * 240;
          fireEvent.scroll(carousel);
          const active = within(carousel)
            .getAllByRole("link", { hidden: true })
            .find((item) =>
              item.getAttribute("aria-label")?.endsWith("を開く"),
            );
          visited.push(
            games.findIndex((game) =>
              active?.getAttribute("aria-label")?.startsWith(game.name),
            ),
          );
        }
      }
      fireEvent(carousel, new Event("scrollend", { bubbles: true }));

      expect(visited).toHaveLength(36);
      expect(visited.every((index) => index >= 0)).toBe(true);
      expect(carousel.scrollLeft).toBeGreaterThanOrEqual(games.length * 240);
      expect(carousel.scrollLeft).toBeLessThan(games.length * 2 * 240);
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  test("トラック端で次のホイール入力が来ても同じゲームを保って循環できること", () => {
    const carousel = getCarousel();
    carousel.scrollLeft = (games.length * 3 - 1) * 240;
    fireEvent.scroll(carousel);

    fireEvent.wheel(carousel, { deltaX: 240 });

    expect(carousel.scrollLeft).toBe((games.length * 2 - 1) * 240);
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
  });

  test("スワイプ中の候補の移動に効果音を返し、停止後に決定音を重ねないこと", () => {
    const carousel = getCarousel();
    fireEvent.pointerDown(carousel, { pointerType: "touch", pointerId: 1 });
    scrollToSlide(4, false);
    const soundsDuringSwipe = vi.mocked(playSound).mock.calls;
    fireEvent(carousel, new Event("scrollend", { bubbles: true }));

    expect(soundsDuringSwipe).toHaveLength(1);
    expect(soundsDuringSwipe[0]?.[0]).toEqual(
      appDecisionSound.carouselMoveSound,
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  test("画面サイズが変わっても中央の周と選択中のゲームを維持すること", () => {
    cleanup();
    renderGallery(2);
    getCarousel();
    scrollTo.mockClear();

    fireEvent(window, new Event("resize"));

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 1200,
      behavior: "instant",
    });
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("同じ候補へのスクロールでは効果音を鳴らさないこと", () => {
    scrollToSlide(3);
    expect(onSelect).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
  });

  test("現在のパズルのタップではプレイ開始音を鳴らすこと", () => {
    fireEvent.click(
      screen.getByRole("link", { name: "ウォーターソートを開く" }),
    );
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.playStartSound,
    );
  });

  test("記録へ進む操作ではゲーム選択音を鳴らさないこと", () => {
    const link = screen.getByRole("link", { name: "記録" });
    fireEvent.click(link);
    expect(link.getAttribute("href")).toBe("/records");
    expect(playSound).not.toHaveBeenCalled();
  });

  test("左右キーは循環し、Home・Endキーで任意の端まで移動できること", () => {
    const carousel = getCarousel();
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
    fireEvent.keyDown(carousel, { key: "End" });
    fireEvent.keyDown(carousel, { key: "Home" });
    expect(
      within(
        screen.getByRole("link", { name: "ウォーターソートを開く" }),
      ).getByText("01"),
    ).toBeTruthy();
  });
});

describe("下の帯の遊ぶ操作", () => {
  beforeEach(() => {
    renderGallery(1);
  });

  test("選んでいるゲームへ入る操作を置き、押すとプレイ開始音を鳴らすこと", () => {
    const link = screen.getByRole("link", { name: "ナンプレを遊ぶ" });
    fireEvent.click(link);

    expect(link.getAttribute("href")).toBe("/puzzles/nanpure");
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.playStartSound,
    );
  });
});

describe("キーボードで選ぶ操作", () => {
  describe("細かく指せる端末で開いた場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({ matches: query === "(pointer: fine)" })),
      );
      renderGallery();
    });

    test("中央のカードにフォーカスを置くこと", () => {
      const focused = document.activeElement;

      expect(focused?.getAttribute("aria-label")).toBe(
        "ウォーターソートを開く",
      );
    });

    test("カードで右キーを押すと、次のカードを中央にしてフォーカスを移すこと", () => {
      getCarousel();
      fireEvent.keyDown(document.activeElement as Element, {
        key: "ArrowRight",
      });
      const focused = document.activeElement;

      expect(focused?.getAttribute("aria-label")).toBe("ナンプレを開く");
    });
  });

  describe("タッチの端末で開いた場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      renderGallery();
    });

    test("カードにフォーカスを置かないこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(document.body);
    });
  });
});

describe("選んだゲームの情報", () => {
  test("挑戦中の問題は選択中のゲームにだけ表示すること", () => {
    renderGallery(1, { difficulty: "3", attemptedCount: 2 });
    const current = screen.getByRole("link", { name: "ナンプレを開く" });
    const badge = screen.getByText("レベル 3 ・ 挑戦中 2問");
    expect(current.contains(badge)).toBe(true);
    expect(current.getAttribute("aria-describedby")).toBe(badge.id);
  });

  test("挑戦中の問題が無い場合はレベルのみ表示すること", () => {
    renderGallery(0, { difficulty: "1", attemptedCount: 0 });
    expect(screen.getByText("レベル 1")).toBeTruthy();
  });

  test("未プレイのゲームには続きの情報を表示しないこと", () => {
    renderGallery();
    const current = screen.getByRole("link", {
      name: "ウォーターソートを開く",
    });
    expect(current.getAttribute("aria-describedby")).toBeNull();
  });

  test("タイトルに覆われている間はピクトグラムの動きを止めること", () => {
    renderGallery(0, null, true);
    const pictogram = screen
      .getByRole("link", { name: "ウォーターソートを開く" })
      .querySelector('svg[data-game="water-showcase"]');
    expect(pictogram?.closest("[data-pictogram-motion]")).toBeNull();
  });
});

describe("設定", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    renderGallery();
  });
  test("設定から音量調整を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    const dialog = screen.getByRole("dialog", { name: "設定" });
    fireEvent.click(within(dialog).getByRole("button", { name: /サウンド/ }));
    expect(screen.getByRole("dialog", { name: "サウンド" })).toBeTruthy();
    expect(playSound).not.toHaveBeenCalled();
  });
});
