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

const lapCount = 15;
const middleLapStart = games.length * Math.floor(lapCount / 2);

function scrollToSlide(offsetFromMiddleLapStart: number, settle = true) {
  const carousel = getCarousel();
  carousel.scrollLeft = (middleLapStart + offsetFromMiddleLapStart) * 240;
  fireEvent.scroll(carousel);
  if (settle) fireEvent(carousel, new Event("scrollend", { bubbles: true }));
}

describe("パズルの選択", () => {
  beforeEach(() => renderGallery());

  test("左右が連続するよう全候補を15周並べ、比較画面や小さな一覧を出さないこと", () => {
    const carousel = getCarousel();
    expect(
      within(carousel).getAllByRole("link", { hidden: true }),
    ).toHaveLength(games.length * lapCount);
    expect(
      screen.queryByRole("navigation", { name: "デザイン案の比較" }),
    ).toBeNull();
    expect(screen.queryByRole("navigation", { name: "パズル一覧" })).toBeNull();
    expect(screen.queryByText("遊ぶ")).toBeNull();
  });

  test("中央の候補は選択確定の待機なしで開けること", () => {
    scrollToSlide(1, false);
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
    scrollToSlide(1);
    expect(screen.getByRole("link", { name: "ナンプレを開く" })).toBeTruthy();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.carouselMoveSound,
      { variation: { pitchCents: 30, volumeRatio: 0.12 }, volume: 0.48 },
    );
  });

  test("スクロール中の表示は即時更新し、確定音は停止まで鳴らさないこと", () => {
    scrollToSlide(2, false);
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
    expect(screen.getAllByText("03").length).toBeGreaterThan(0);
    expect(onSelect).not.toHaveBeenCalled();
    scrollToSlide(2);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
  });

  test("最後から最初へスライドし、中央の周へ継ぎ目なく戻ること", () => {
    cleanup();
    renderGallery(2);
    getCarousel();
    scrollToSlide(3);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(0);
    expect(
      within(
        screen.getByRole("link", { name: "ウォーターソートを開く" }),
      ).getByText("01"),
    ).toBeTruthy();
    expect(getCarousel().scrollLeft).toBe(middleLapStart * 240);
  });

  test("最初から最後へ逆方向にも循環できること", () => {
    scrollToSlide(-1);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getAllByText("03").length).toBeGreaterThan(0);
    expect(getCarousel().scrollLeft).toBe((middleLapStart + 2) * 240);
  });

  test.each([1, -1])(
    "マウスでは、停止を待たずに一方向へ何周もスクロールしても端で止まらないこと: %i",
    (direction) => {
      const carousel = getCarousel();
      carousel.scrollLeft = middleLapStart * 240;
      fireEvent.pointerDown(carousel, { pointerType: "mouse", pointerId: 1 });
      const visited: number[] = [];
      for (let lap = 0; lap < 12; lap++) {
        for (let index = 0; index < games.length; index++) {
          fireEvent.pointerDown(carousel, {
            pointerType: "mouse",
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
      expect(carousel.scrollLeft).toBeGreaterThanOrEqual(middleLapStart * 240);
      expect(carousel.scrollLeft).toBeLessThan(
        (middleLapStart + games.length) * 240,
      );
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  test("トラック端で次のホイール入力が来ても同じゲームを保って循環できること", () => {
    const carousel = getCarousel();
    carousel.scrollLeft = (games.length * lapCount - 1) * 240;
    fireEvent.scroll(carousel);

    fireEvent.wheel(carousel, { deltaX: 240 });

    expect(carousel.scrollLeft).toBe((middleLapStart + games.length - 1) * 240);
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
  });

  test("スワイプ中の候補の移動に効果音を返し、停止後に決定音を重ねないこと", () => {
    const carousel = getCarousel();
    fireEvent.pointerDown(carousel, { pointerType: "touch", pointerId: 1 });
    scrollToSlide(1, false);
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
      left: (middleLapStart + 2) * 240,
      behavior: "instant",
    });
    expect(
      screen.getByRole("link", { name: "マインスイーパーを開く" }),
    ).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("同じ候補へのスクロールでは効果音を鳴らさないこと", () => {
    scrollToSlide(0);
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

describe("スライドの間隔が整数でない場合", () => {
  const step = 240.8;
  let carousel: HTMLElement;

  beforeEach(() => {
    renderGallery();
    carousel = getCarousel();
    for (const [position, item] of Array.from(carousel.children).entries()) {
      Object.defineProperty(item, "offsetLeft", {
        configurable: true,
        value: Math.round(75 + position * step),
      });
    }
  });

  test("中央の周に止まっている候補を、選んでいる大きさで見せること", () => {
    carousel.scrollLeft = Math.round(middleLapStart * step);

    fireEvent.scroll(carousel);

    const proximity = Number(
      screen
        .getByRole("link", { name: "ウォーターソートを開く" })
        .style.getPropertyValue("--proximity"),
    );
    expect(proximity).toBeGreaterThan(0.99);
  });
});

describe("指で端の周まで送った場合", () => {
  const firstLapLastSlide = -(middleLapStart + 1) + games.length;

  beforeEach(() => {
    vi.useFakeTimers();
    renderGallery();
    fireEvent.touchStart(getCarousel(), { touches: [{ identifier: 1 }] });
    scrollToSlide(firstLapLastSlide, false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("指が触れている間は、触れた直後にスクロールの終わりが知らされても、次に触れても、動きが止んでも、位置を移さないこと", () => {
    const carousel = getCarousel();

    fireEvent(carousel, new Event("scrollend", { bubbles: true }));
    fireEvent.pointerDown(carousel, { pointerType: "touch", pointerId: 2 });
    vi.runAllTimers();

    expect(carousel.scrollLeft).toBe((games.length - 1) * 240);
  });

  test("指を離した知らせが来ないまま、触れてしばらくしてからスクロールの終わりが知らされたら、中央の周へ位置を移すこと", () => {
    const carousel = getCarousel();
    vi.advanceTimersByTime(1000);

    fireEvent(carousel, new Event("scrollend", { bubbles: true }));

    expect(carousel.scrollLeft).toBe((middleLapStart + games.length - 1) * 240);
  });

  test("指を離して動きが止んだら、スクロールの終わりが知らされなくても、中央の周へ位置を移して選ぶこと", () => {
    const carousel = getCarousel();

    fireEvent.touchEnd(carousel, { touches: [] });
    vi.runAllTimers();

    expect([carousel.scrollLeft, onSelect.mock.calls]).toEqual([
      (middleLapStart + games.length - 1) * 240,
      [[games.length - 1]],
    ]);
  });
});

describe("マウスで周の継ぎ目を越える場合", () => {
  const nextLapFirstSlide = games.length;
  const middleLap = Math.floor(lapCount / 2);
  const continuationText = "レベル 2 ・ 挑戦中 1問";

  function copiesOf(name: string) {
    return within(getCarousel())
      .getAllByRole("link", { hidden: true })
      .filter((link) => link.getAttribute("aria-label")?.startsWith(name));
  }

  beforeEach(() => {
    const { rerender } = renderGallery(1);
    onSelect.mockImplementation((index: number) =>
      rerender(
        <MemoryRouter>
          <GameSelectionGallery
            games={games}
            recordsTo="/records"
            selectedIndex={index}
            continuation={{ difficulty: "2", attemptedCount: 1 }}
            onSelect={onSelect}
          />
        </MemoryRouter>,
      ),
    );
  });
  afterEach(() => {
    onSelect.mockReset();
  });

  test("止まる前から、中央に来た複製と、移す先になる中央の周の複製だけを、選んでいる大きさと動く姿で見せること", () => {
    scrollToSlide(nextLapFirstSlide, false);

    const selectedLaps = copiesOf("ウォーターソート").flatMap((copy, lap) =>
      copy.style.getPropertyValue("--proximity") === "1.000" &&
      copy.querySelector(
        '[data-pictogram-motion="play"] svg[data-game="water-showcase"]',
      )
        ? [lap]
        : [],
    );
    const shownLaps = copiesOf("ウォーターソート").flatMap((copy, lap) =>
      copy.querySelector('svg[data-game="water-showcase"]') ? [lap] : [],
    );
    expect([selectedLaps, shownLaps]).toEqual([
      [middleLap, middleLap + 1],
      [middleLap, middleLap + 1],
    ]);
  });

  describe("次の周の先頭まで送った場合", () => {
    let middleCopy: HTMLElement | undefined;
    let pictogramBefore: Element | null | undefined;

    beforeEach(() => {
      scrollToSlide(nextLapFirstSlide, false);
      middleCopy = copiesOf("ウォーターソート")[middleLap];
      pictogramBefore = middleCopy?.querySelector("svg");
    });

    test("止まって中央の周へ位置を移しても、移した先の姿を描き替えないこと", () => {
      fireEvent(getCarousel(), new Event("scrollend", { bubbles: true }));

      expect([
        getCarousel().scrollLeft,
        middleCopy?.querySelector("svg") === pictogramBefore,
        middleCopy?.getAttribute("aria-label"),
      ]).toEqual([middleLapStart * 240, true, "ウォーターソートを開く"]);
    });

    test("止まった後の続きを、中央の複製にだけ示して説明として結び付けること", () => {
      fireEvent(getCarousel(), new Event("scrollend", { bubbles: true }));

      const copies = copiesOf("ウォーターソート");
      const badgeIds = copies.map(
        (copy) => within(copy).queryByText(continuationText)?.id,
      );
      const describedBy = copies.map((copy) =>
        copy.getAttribute("aria-describedby"),
      );
      expect([badgeIds, describedBy]).toEqual([
        badgeIds.map((_, lap) =>
          lap === middleLap ? badgeIds[middleLap] : undefined,
        ),
        badgeIds.map((_, lap) =>
          lap === middleLap ? badgeIds[middleLap] : null,
        ),
      ]);
      expect(badgeIds[middleLap]).toBeTruthy();
    });

    test("中央の扱いになっていない複製を押しても、選んでいるゲームを開くこと", () => {
      const middleLapCopy = copiesOf("ウォーターソート")[middleLap];

      fireEvent.click(middleLapCopy as HTMLElement);

      expect(playSound).toHaveBeenLastCalledWith(
        appDecisionSound.playStartSound,
      );
    });
  });
});

describe("選んだゲームの情報", () => {
  test("挑戦中の問題は選択中のゲームにだけ表示すること", () => {
    renderGallery(1, { difficulty: "3", attemptedCount: 2 });
    const current = screen.getByRole("link", { name: "ナンプレを開く" });
    const badge = within(current).getByText("レベル 3 ・ 挑戦中 2問");
    expect(current.getAttribute("aria-describedby")).toBe(badge.id);
  });

  test("挑戦中の問題が無い場合はレベルのみ表示すること", () => {
    renderGallery(0, { difficulty: "1", attemptedCount: 0 });
    const current = screen.getByRole("link", {
      name: "ウォーターソートを開く",
    });
    expect(within(current).getByText("レベル 1")).toBeTruthy();
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
