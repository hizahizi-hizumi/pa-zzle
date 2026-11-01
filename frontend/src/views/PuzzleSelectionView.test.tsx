import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { _private, startAppLaunch } from "@/lib/app-launch";
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
