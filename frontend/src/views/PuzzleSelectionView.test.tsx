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
      const selectButtons = screen.getAllByRole("button", {
        name: /を選択$/,
      });

      expect(
        selectButtons.map((button) => button.getAttribute("aria-label")),
      ).toEqual(games.map(([name]) => `${name}を選択`));
    });

    test.each(games)(
      "%sを選択してそのゲームのホームへ進めること",
      (name, homePath) => {
        const selectButton = screen.getByRole("button", {
          name: `${name}を選択`,
        });

        fireEvent.click(selectButton);

        const heroLink = screen.getByRole("link", { name: `${name}を遊ぶ` });
        expect(heroLink.getAttribute("href")).toBe(homePath);
        expect(selectButton.getAttribute("aria-pressed")).toBe("true");
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

  test("下部一覧を設定順にし、履歴がなければ先頭のゲームを選んでおくこと", () => {
    const selectButtons = screen.getAllByRole("button", { name: /を選択$/ });
    const selected = screen.getByRole("link", {
      name: "ナンプレを遊ぶ",
    });

    expect(selectButtons[0]?.getAttribute("aria-label")).toBe("ナンプレを選択");
    expect(selectButtons[1]?.getAttribute("aria-label")).toBe(
      "ウォーターソートを選択",
    );
    expect(selected.getAttribute("href")).toBe("/puzzles/nanpure");
  });

  test("並び替えた2番目を選んでも対応するゲームへ進めること", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "ウォーターソートを選択" }),
    );
    const selected = screen.getByRole("link", {
      name: "ウォーターソートを遊ぶ",
    });

    expect(selected.getAttribute("href")).toBe("/puzzles/water-sort");
  });

  test("並び替えによる位置の変更で選択中のゲームが切り替わらないこと", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "ウォーターソートを選択" }),
    );
    act(() => gameSelectionOrderSetting.restoreDefault());
    const selected = screen.getByRole("link", {
      name: "ウォーターソートを遊ぶ",
    });

    expect(selected.getAttribute("href")).toBe("/puzzles/water-sort");
    expect(
      screen
        .getByRole("button", { name: "ウォーターソートを選択" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
