import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { _private, startAppLaunch } from "@/lib/app-launch";
import {
  _private as gameOrderPrivate,
  gameSelectionOrderSetting,
} from "@/lib/game-selection-order-setting";
import { PuzzleSelectionView } from "@/views/PuzzleSelectionView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const { resetAppLaunch } = _private;
const nanpureHomeText = "ナンプレのホーム";

beforeAll(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});

function selectGameByName(name: string) {
  const carousel = screen.getByRole("group", {
    name: "左右にスライドしてパズルを切り替え",
  });
  const links = Array.from(carousel.children);
  const centerLapStart = links.length / 3;
  const index = links
    .slice(centerLapStart, centerLapStart * 2)
    .findIndex((item) => item.getAttribute("aria-label")?.startsWith(name));
  if (index < 0) throw new Error(`Missing game: ${name}`);
  Object.defineProperty(carousel, "clientWidth", {
    configurable: true,
    value: 390,
  });
  for (const [position, item] of links.entries()) {
    Object.defineProperty(item, "offsetLeft", {
      configurable: true,
      value: 75 + position * 240,
    });
    Object.defineProperty(item, "offsetWidth", {
      configurable: true,
      value: 240,
    });
  }
  fireEvent.click(links[centerLapStart + index]!);
  carousel.scrollLeft = (centerLapStart + index) * 240;
  fireEvent.scroll(carousel);
  fireEvent(carousel, new Event("scrollend", { bubbles: true }));
}

function renderAtHome() {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<PuzzleSelectionView />} />
        <Route path="/puzzles/nanpure" element={<p>{nanpureHomeText}</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 効果音の読み込みを待ち終える。テストの環境には Web Audio API が無いので、待たずに済む。 */
async function launchApp(showTitle: boolean) {
  await act(async () => {
    startAppLaunch({ showTitle, sounds: [] });
  });
}

afterEach(() => {
  cleanup();
  resetAppLaunch();
  window.localStorage.clear();
  gameOrderPrivate.resetCache();
});

describe("PuzzleSelectionView", () => {
  const games = [
    ["ウォーターソート", "/puzzles/water-sort"],
    ["ナンプレ", "/puzzles/nanpure"],
    ["マインスイーパー", "/puzzles/minesweeper"],
    ["パーキングジャム", "/puzzles/parking-jam"],
    ["スライドパズル", "/puzzles/slide-puzzle"],
    ["バイナリパズル", "/puzzles/takuzu"],
    [REFLECTION_DISPLAY_NAME, "/puzzles/reflection"],
    [HITOFUDE_PUZZLE_DISPLAY_NAME, "/puzzles/hitofude-puzzle"],
    [ICE_FLOOR_MAZE_DISPLAY_NAME, "/puzzles/ice-floor-maze"],
    [TSUME_SHOGI_DISPLAY_NAME, "/puzzles/tsume-shogi"],
    [BRIDGES_DISPLAY_NAME, "/puzzles/bridges"],
  ] as const;

  describe("タイトルを閉じた後の場合", () => {
    beforeEach(() => {
      renderAtHome();
    });

    test("パズルを決まった順に並べること", () => {
      const carousel = screen.getByRole("group", {
        name: "左右にスライドしてパズルを切り替え",
      });
      const gameLinks = Array.from(carousel.children).slice(
        games.length,
        games.length * 2,
      );

      expect(gameLinks.map((link) => link.getAttribute("aria-label"))).toEqual(
        games.map(
          ([name], index) => `${name}${index === 0 ? "を開く" : "を選択"}`,
        ),
      );
    });

    test.each(games)(
      "%sを選択してそのゲームのホームへ進めること",
      (name, homePath) => {
        if (name !== games[0][0]) selectGameByName(name);

        const heroLink = screen.getByRole("link", { name: `${name}を開く` });
        expect(heroLink.getAttribute("href")).toBe(homePath);
      },
    );
  });

  describe("アプリをホームで開いた場合", () => {
    beforeEach(async () => {
      await launchApp(true);
      renderAtHome();
    });

    test("ホームの上にタイトルを重ね、全ゲームを入口として並べること", () => {
      const title = screen.getByRole("dialog", { name: "pa-zzle" });
      const gameLinks = screen
        .getAllByRole("link")
        .filter((link) => title.contains(link));

      expect(gameLinks.map((link) => link.getAttribute("href"))).toEqual(
        games.map(([, homePath]) => homePath),
      );
    });

    test("ピクトグラムを押すと、そのゲームのホームへ直接入ること", () => {
      fireEvent.click(screen.getByRole("link", { name: "ナンプレを遊ぶ" }));

      const gameHome = screen.getByText(nanpureHomeText);
      expect(gameHome).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    describe("タイトルから入った後にホームを出し直した場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByText("タップしてはじめる"));
        cleanup();
        renderAtHome();
      });

      test("タイトルを出さないこと", () => {
        const title = screen.queryByRole("dialog");

        expect(title).toBeNull();
      });
    });
  });

  describe("アプリをホーム以外で開いた後にホームへ来た場合", () => {
    beforeEach(async () => {
      await launchApp(false);
      renderAtHome();
    });

    test("タイトルを出さないこと", () => {
      const title = screen.queryByRole("dialog");

      expect(title).toBeNull();
    });
  });
});

describe("保存されたホームの並び順", () => {
  beforeEach(() => {
    gameSelectionOrderSetting.setOrder(["nanpure", "water-sort"]);
    renderAtHome();
  });

  test("保存された並び順で表示し、履歴がなければ先頭を選んでおくこと", () => {
    const carousel = screen.getByRole("group", {
      name: "左右にスライドしてパズルを切り替え",
    });
    const count = carousel.children.length / 3;
    const links = Array.from(carousel.children).slice(count, count * 2);

    expect(links[0]?.getAttribute("aria-label")).toBe("ナンプレを開く");
    expect(links[1]?.getAttribute("aria-label")).toBe("ウォーターソートを選択");
    expect(links[0]?.getAttribute("href")).toBe("/puzzles/nanpure");
  });

  test("並び替えた2番目を選んでも対応するゲームへ進めること", () => {
    selectGameByName("ウォーターソート");
    const selected = screen.getByRole("link", {
      name: "ウォーターソートを開く",
    });

    expect(selected.getAttribute("href")).toBe("/puzzles/water-sort");
  });

  test("並び替えによる位置の変更で選択中のゲームが切り替わらないこと", () => {
    selectGameByName("ウォーターソート");
    act(() => gameSelectionOrderSetting.restoreDefault());
    const selected = screen.getByRole("link", {
      name: "ウォーターソートを開く",
    });

    expect(selected.getAttribute("href")).toBe("/puzzles/water-sort");
    expect(
      screen.getByRole("link", { name: "ウォーターソートを開く" }),
    ).toBeTruthy();
  });
});
