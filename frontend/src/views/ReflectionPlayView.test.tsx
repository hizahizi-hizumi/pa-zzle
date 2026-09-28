import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { formatReflectionProblemQuery } from "@/games/reflection/diagnostics";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { writeReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { ReflectionPlayView } from "@/views/ReflectionPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

beforeEach(() => {
  writeReflectionHowToPlaySeen();
});

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/reflection/play/:difficulty"
          element={<ReflectionPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function getBoardCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: `${REFLECTION_DISPLAY_NAME}盤面` }),
  ).getAllByRole("button");
}

const specifiedProblemPath = `/puzzles/reflection/play/1?${formatReflectionProblemQuery(createReflectionProblemIdentity(7, 10, 0))}`;

describe("ReflectionPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/1");
    });

    test("空の盤面とストックを持つプレイ画面を表示すること", () => {
      const cells = getBoardCells();
      const stock = within(
        screen.getByRole("group", { name: "ストック" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(25);
      expect(cells.every((cell) => cell.textContent === "")).toBe(true);
      expect(stock.length).toBeGreaterThan(0);
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/9");
    });

    test("選べない難易度であることを示しホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "ホームへ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/");
    });
  });

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      renderAt(specifiedProblemPath);
    });

    test("指定を無視して難易度の問題を出すこと", () => {
      const cells = getBoardCells();

      expect(cells).toHaveLength(25);
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(specifiedProblemPath);
    });

    test("指定した問題を出すこと", () => {
      const cells = getBoardCells();

      expect(cells).toHaveLength(49);
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/1?seed=abc&size=8&pieces=3");
    });

    test("指定を復元できないことを示すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");

      expect(message).toBeTruthy();
    });
  });
});
