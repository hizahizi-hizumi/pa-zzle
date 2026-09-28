import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { formatReflectionProblemQuery } from "@/games/reflection/diagnostics";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { writeReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
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
        <Route path="/puzzles/reflection" element={<p>難易度選択画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getBoardCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: `${REFLECTION_DISPLAY_NAME}盤面` }),
  ).getAllByRole("button");
}

const specifiedProblemIdentity = createReflectionProblemIdentity(7, 10, 0);
const specifiedProblemPath = `/puzzles/reflection/play/1?${formatReflectionProblemQuery(specifiedProblemIdentity)}`;

/** 指定した問題の解どおりに、ストックの種類を選んでからマスを押して置く。 */
function solveSpecifiedProblem(): void {
  const { solution } = generateReflectionProblem(
    specifiedProblemIdentity,
  ).problem;
  const stock = screen.getByRole("group", { name: "ストック" });
  const cells = getBoardCells();
  solution.cells.forEach((piece, cellIndex) => {
    if (piece === null) return;
    const stockButton = within(stock).getByRole("button", {
      name: new RegExp(`^${reflectionPieceLabels[piece]} `),
    });
    // 置いた後も同じ種類が残っていれば選択が続くので、選ばれていない時だけ押す。
    if (stockButton.getAttribute("aria-pressed") !== "true") {
      fireEvent.click(stockButton);
    }
    fireEvent.click(cells[cellIndex] as HTMLElement);
  });
}

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

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューの難易度変更で難易度選択画面へ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("内部診断を使えないビルドではメニューに検証情報を出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/3");
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(within(dialog).getByText("レベル 3")).toBeTruthy();
      expect(within(dialog).getByText(/^rf-/)).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/reflection");
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

    test("解き終えた表示で難易度を伏せること", () => {
      solveSpecifiedProblem();
      const status = screen.getByRole("status");

      expect(within(status).getByText("問題指定")).toBeTruthy();
      expect(within(status).queryByText("レベル 1")).toBeNull();
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/1?seed=abc&size=8&pieces=3");
    });

    test("指定を復元できないことを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/reflection");
    });
  });
});
