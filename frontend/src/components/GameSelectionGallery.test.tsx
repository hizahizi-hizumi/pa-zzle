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
  playSound: vi.fn(),
}));

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="water-sort" />',
    to: "/puzzles/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="nanpure" />',
    to: "/puzzles/nanpure",
  },
] as const;

const onSelect = vi.fn();

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  onSelect.mockClear();
  window.localStorage.clear();
});

function renderGallery({
  selectedIndex = 0,
  continuation = null,
}: {
  selectedIndex?: number;
  continuation?: GameSelectionContinuation | null;
} = {}) {
  return render(
    <MemoryRouter>
      <GameSelectionGallery
        games={games}
        recordsTo="/records"
        selectedIndex={selectedIndex}
        continuation={continuation}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );
}

describe("先頭のパズルを選んでいる場合", () => {
  beforeEach(() => {
    renderGallery();
  });

  test("選んでいるパズルをヒーローとして表示すること", () => {
    const heroLink = screen.getByRole("link", {
      name: "ウォーターソートを遊ぶ",
    });

    expect(heroLink.getAttribute("href")).toBe("/puzzles/water-sort");
    expect(heroLink.querySelector('svg[data-game="water-sort"]')).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "ウォーターソートを選択" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("候補を選ぶと、その候補の位置を知らせること", () => {
    fireEvent.click(screen.getByRole("button", { name: "ナンプレを選択" }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
  });

  test("記録画面への導線を表示すること", () => {
    const recordsLink = screen.getByRole("link", { name: "記録" });

    expect(recordsLink.getAttribute("href")).toBe("/records");
  });
});

describe("2番目のパズルを選んでいる場合", () => {
  beforeEach(() => {
    renderGallery({ selectedIndex: 1 });
  });

  test("そのパズルをヒーローとして表示すること", () => {
    const heroLink = screen.getByRole("link", { name: "ナンプレを遊ぶ" });

    expect(heroLink.getAttribute("href")).toBe("/puzzles/nanpure");
    expect(heroLink.querySelector('svg[data-game="nanpure"]')).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "ナンプレを選択" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("選んでいるパズルの続き", () => {
  describe("挑戦中の問題がある場合", () => {
    beforeEach(() => {
      renderGallery({ continuation: { difficulty: "3", attemptedCount: 2 } });
    });

    test("開くレベルと挑戦中の問題の数を、ヒーローの説明として示すこと", () => {
      const heroLink = screen.getByRole("link", {
        name: "ウォーターソートを遊ぶ",
      });
      const continuation = screen.getByText("レベル 3 ・ 挑戦中 2問");

      expect(heroLink.contains(continuation)).toBe(true);
      expect(heroLink.getAttribute("aria-describedby")).toBe(continuation.id);
    });
  });

  describe("挑戦中の問題が無い場合", () => {
    beforeEach(() => {
      renderGallery({ continuation: { difficulty: "1", attemptedCount: 0 } });
    });

    test("開くレベルだけを示すこと", () => {
      const continuation = screen.getByText("レベル 1");

      expect(continuation.textContent).toBe("レベル 1");
    });
  });

  describe("遊んだことが無い場合", () => {
    beforeEach(() => {
      renderGallery();
    });

    test("続きを示さないこと", () => {
      const heroLink = screen.getByRole("link", {
        name: "ウォーターソートを遊ぶ",
      });

      expect(heroLink.textContent).toBe("ウォーターソート");
      expect(heroLink.hasAttribute("aria-describedby")).toBe(false);
    });
  });
});

describe("遊ぶゲームの選択", () => {
  beforeEach(() => {
    renderGallery();
  });

  test("ヒーローのパズルを選ぶとゲームを選ぶ音を鳴らすこと", () => {
    fireEvent.click(
      screen.getByRole("link", { name: "ウォーターソートを遊ぶ" }),
    );

    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.gameSelectSound,
    );
  });

  test("別のパズルの候補を選ぶとゲームを選ぶ音を鳴らすこと", () => {
    fireEvent.click(screen.getByRole("button", { name: "ナンプレを選択" }));

    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.gameSelectSound,
    );
  });

  test("選んでいる候補をもう一度押しても音を鳴らさないこと", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "ウォーターソートを選択" }),
    );

    expect(playSound).not.toHaveBeenCalled();
  });

  test("記録への移動では音を鳴らさないこと", () => {
    fireEvent.click(screen.getByRole("link", { name: "記録" }));

    expect(playSound).not.toHaveBeenCalled();
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

  test("見出しの設定ボタンで、効果音と BGM の音量を選ぶダイアログを開き、開く操作では音を鳴らさないこと", () => {
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    const dialog = screen.getByRole("dialog", { name: "設定" });
    const volumeNames = within(dialog)
      .getAllByRole("group")
      .map((group) => group.textContent);
    expect(volumeNames).toEqual(["効果音5", "BGM5"]);
    expect(playSound).not.toHaveBeenCalled();
  });
});

describe("選んでいるパズルの色と動きのあるピクトグラム", () => {
  const gamesWithShowcase = [
    {
      ...games[0],
      pictogramShowcaseSvg:
        '<svg viewBox="0 0 120 120" data-game="water-sort-showcase" />',
    },
    games[1],
  ];

  function renderWithShowcase(selectedIndex: number, isCovered = false) {
    return render(
      <MemoryRouter>
        <GameSelectionGallery
          games={gamesWithShowcase}
          recordsTo="/records"
          selectedIndex={selectedIndex}
          continuation={null}
          onSelect={onSelect}
          isCovered={isCovered}
        />
      </MemoryRouter>,
    );
  }

  function heroPictogramWrapper(name: string) {
    return screen
      .getByRole("link", { name: `${name}を遊ぶ` })
      .querySelector("svg")?.parentElement;
  }

  describe("持っているパズルを選んでいる場合", () => {
    beforeEach(() => {
      renderWithShowcase(0);
    });

    test("ヒーローで動かし、候補では静止させて見せること", () => {
      const heroWrapper = heroPictogramWrapper("ウォーターソート");
      const selectedButton = screen.getByRole("button", {
        name: "ウォーターソートを選択",
      });

      expect(
        heroWrapper?.querySelector('svg[data-game="water-sort-showcase"]'),
      ).toBeTruthy();
      expect(heroWrapper?.getAttribute("data-pictogram-motion")).toBe("play");
      expect(
        selectedButton.querySelector('svg[data-game="water-sort-showcase"]'),
      ).toBeTruthy();
      expect(
        selectedButton.querySelector("[data-pictogram-motion]"),
      ).toBeNull();
    });
  });

  describe("持っているパズルを選んでいて、ホームが覆われている場合", () => {
    beforeEach(() => {
      renderWithShowcase(0, true);
    });

    test("ヒーローを動かさずに静止させて待たせること", () => {
      const heroWrapper = heroPictogramWrapper("ウォーターソート");

      expect(
        heroWrapper?.querySelector('svg[data-game="water-sort-showcase"]'),
      ).toBeTruthy();
      expect(heroWrapper?.getAttribute("data-pictogram-motion")).toBeNull();
    });
  });

  describe("持っていないパズルを選んでいる場合", () => {
    beforeEach(() => {
      renderWithShowcase(1);
    });

    test("ヒーローと候補で通常のピクトグラムを静止させて見せること", () => {
      const heroWrapper = heroPictogramWrapper("ナンプレ");

      expect(
        heroWrapper?.querySelector('svg[data-game="nanpure"]'),
      ).toBeTruthy();
      expect(heroWrapper?.getAttribute("data-pictogram-motion")).toBeNull();
    });

    test("選んでいない候補では、持っていても通常のピクトグラムを見せること", () => {
      const unselectedButton = screen.getByRole("button", {
        name: "ウォーターソートを選択",
      });

      expect(
        unselectedButton.querySelector('svg[data-game="water-sort-showcase"]'),
      ).toBeNull();
    });
  });
});
