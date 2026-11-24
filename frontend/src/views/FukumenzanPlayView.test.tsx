import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from "react-router";
import { readPlayAttempts } from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import { createProblemId } from "@/games/problem-id";
import { FukumenzanPlayView } from "@/views/FukumenzanPlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
  window.sessionStorage.clear();
  Reflect.deleteProperty(document, "elementFromPoint");
});

// レベル1の問題。985 + 515 = 1500 で解ける。
const identity = createFukumenzanProblemIdentity({
  addends: ["BYK", "KTK"],
  result: "TKHH",
});
const problemId = createProblemId(identity);
const playPath = `/puzzles/fukumenzan/play/${problemId}`;
const solution = [
  ["B", 9],
  ["Y", 8],
  ["K", 5],
  ["T", 1],
  ["H", 0],
] as const;
const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

function LocationPath() {
  return <output aria-label="プレイURL">{useLocation().pathname}</output>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/fukumenzan/play/:problemId"
          element={
            <>
              <FukumenzanPlayView />
              <LocationPath />
            </>
          }
        />
        <Route path="/puzzles/fukumenzan" element={<p>ゲームのホーム画面</p>} />
        <Route
          path="/puzzles/:game/result/:recordId"
          element={<PlayResultView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function getEquation() {
  return within(screen.getByRole("group", { name: "式" }));
}

function getCardRow() {
  return within(screen.getByRole("group", { name: "札" }));
}

function getLetterTiles(letter: string): HTMLElement[] {
  return getEquation().getAllByRole("button", {
    name: new RegExp(`^${letter}( に \\d|（候補 \\d+）)?$`),
  });
}

function tapLetter(letter: string): void {
  fireEvent.click(getLetterTiles(letter)[0]!);
}

function tapCard(digit: number): void {
  fireEvent.click(
    getCardRow().getByRole("button", {
      name: new RegExp(`^${digit} の札(（×）)?$`),
    }),
  );
}

function placeByTaps(letter: string, digit: number): void {
  tapCard(digit);
  tapLetter(letter);
}

function readTiles(letter: string): string[] {
  return getLetterTiles(letter).map((tile) => tile.textContent ?? "");
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getResultScreen() {
  return within(screen.getByRole("region", { name: "プレイ結果" }));
}

describe("FukumenzanPlayView", () => {
  describe("問題集の問題 ID で開いた場合", () => {
    beforeEach(() => {
      renderAt(playPath);
    });

    test("空の式と 0〜9 の札を並べ、その問題 ID の URL を示すこと", () => {
      const tiles = getEquation().getAllByRole("button");
      const cards = getCardRow().getAllByRole("button");
      const path = screen.getByRole("status", { name: "プレイURL" });

      expect(tiles.map((tile) => tile.textContent).join("")).toBe("BYKKTKTKHH");
      expect(cards.map((card) => card.textContent)).toEqual([..."0123456789"]);
      expect(path.textContent).toBe(playPath);
    });

    test("札を押してから文字を押すと、その文字の全部の場所に札が入り、列から抜けること", () => {
      placeByTaps("K", 5);

      const kTiles = readTiles("K");
      const slot = getCardRow().queryByRole("button", { name: "5 の札の場所" });

      expect(kTiles).toEqual(["5", "5", "5", "5"]);
      expect(slot).not.toBeNull();
    });

    describe("文字を押して選んでから札を押した場合", () => {
      beforeEach(() => {
        tapLetter("B");
        tapCard(0);
      });

      test("札に × を付け、文字には入れないこと", () => {
        const crossed = getCardRow().queryByRole("button", {
          name: "0 の札（×）",
        });

        expect(crossed).not.toBeNull();
        expect(readTiles("B")).toEqual(["B9"]);
      });

      describe("もう一度札を押した場合", () => {
        beforeEach(() => {
          tapCard(0);
        });

        test("× を外すこと", () => {
          const uncrossed = getCardRow().queryByRole("button", {
            name: "0 の札",
          });

          expect(uncrossed).not.toBeNull();
        });
      });
    });

    describe("札の入った文字を選んで列の空いた所を押した場合", () => {
      beforeEach(() => {
        placeByTaps("B", 9);
        tapLetter("B");
        fireEvent.click(
          getCardRow().getByRole("button", { name: "9 の札の場所" }),
        );
      });

      test("札が列へ戻ること", () => {
        const card = getCardRow().queryByRole("button", { name: "9 の札" });

        expect(readTiles("B")).toEqual(["B"]);
        expect(card).not.toBeNull();
      });
    });

    describe("札を押したまま文字へ運んで離した場合", () => {
      beforeEach(() => {
        const card = getCardRow().getByRole("button", { name: "8 の札" });
        const target = getLetterTiles("Y")[0]!;
        // 指を離した位置の下だけに文字を置く。
        document.elementFromPoint = vi.fn((x: number, y: number) =>
          x === 10 && y === 100 ? target : null,
        );
        fireEvent.pointerDown(card, {
          ...touch,
          button: 0,
          clientX: 10,
          clientY: 300,
        });
        fireEvent.pointerMove(card, { ...touch, clientX: 10, clientY: 200 });
        fireEvent.pointerUp(card, { ...touch, clientX: 10, clientY: 100 });
      });

      test("指の下の文字に札が入ること", () => {
        const yTiles = readTiles("Y");

        expect(yTiles).toEqual(["8"]);
      });
    });

    describe("札を入れて待ったを押した場合", () => {
      beforeEach(() => {
        placeByTaps("K", 5);
        fireEvent.click(screen.getByRole("button", { name: "待った" }));
      });

      test("入れた札を列へ戻すこと", () => {
        const kTiles = readTiles("K");

        expect(kTiles).toEqual(["K", "K", "K", "K"]);
      });
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        openMenu();
      });

      test("盤面を戻すを出し、リセットを出さないこと", () => {
        const items = screen
          .getAllByRole("menuitem")
          .map((item) => item.textContent);

        expect(items).not.toContain("リセット");
        expect(items).toContain("盤面を戻す");
      });
    });

    describe("最後の文字を残して解いた場合", () => {
      beforeEach(() => {
        for (const [letter, digit] of solution.slice(0, -1)) {
          placeByTaps(letter, digit);
        }
      });

      test("記録を保存しないこと", () => {
        const records = readPlayRecords();

        expect(records).toEqual([]);
      });

      describe("最後の文字に札を入れた場合", () => {
        beforeEach(() => {
          const [letter, digit] = solution.at(-1)!;
          placeByTaps(letter, digit);
        });

        test("遊んだ問題と作業の量とプレイの事実を記録へ保存すること", () => {
          const records = readPlayRecords();

          expect(records).toHaveLength(1);
          expect(records[0]).toMatchObject({
            gameId: "fukumenzan",
            payload: {
              difficulty: "1",
              problemIdentity: identity,
              workload: { letterCount: 5, letterCellCount: 10 },
              performance: {
                undoCount: 0,
                restartCount: 0,
                placeCount: 5,
                returnCount: 0,
                crossToggleCount: 0,
              },
            },
          });
        });

        test("保存した記録の結果画面で難易度とスコアを示すこと", () => {
          const resultScreen = getResultScreen();

          expect(resultScreen.getByText("レベル 1")).toBeTruthy();
          expect(
            resultScreen.getByRole("region", { name: "スコア" }),
          ).toBeTruthy();
        });
      });
    });

    describe("札を1枚入れて別の問題へ移った場合", () => {
      beforeEach(() => {
        placeByTaps("B", 9);
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
      });

      test("離れたプレイの進み具合を、札を入れた文字の数とともに記録すること", () => {
        const abandoned = readPlayAttempts().find(
          (attempt) => attempt.abandonment !== null,
        );

        expect(abandoned?.abandonment?.progress).toMatchObject({
          placedLetterCount: 1,
          letterCount: 5,
          placeCount: 1,
        });
      });
    });
  });

  describe("全部の文字を埋めて記録を保存した場合", () => {
    let router: ReturnType<typeof createMemoryRouter>;

    beforeEach(() => {
      router = createMemoryRouter(
        [
          {
            path: "/puzzles/fukumenzan/play/:problemId",
            element: <FukumenzanPlayView />,
          },
          {
            path: "/puzzles/:game/result/:recordId",
            element: <PlayResultView />,
          },
        ],
        { initialEntries: [playPath] },
      );
      render(<RouterProvider router={router} />);
      for (const [letter, digit] of solution) {
        placeByTaps(letter, digit);
      }
    });

    test("記録の結果画面のパスへ履歴を置き換えて移ること", () => {
      const [record] = readPlayRecords();

      expect(router.state.location.pathname).toBe(
        `/puzzles/fukumenzan/result/${encodeURIComponent(record?.id ?? "")}`,
      );
      expect(router.state.historyAction).toBe("REPLACE");
      expect(getResultScreen().getByText("レベル 1")).toBeTruthy();
    });
  });

  describe("存在しない問題 ID で開いた場合", () => {
    beforeEach(() => renderAt("/puzzles/fukumenzan/play/invalid"));

    test("別の問題にすり替えず、開けないことを知らせること", () => {
      const notice = screen.getByText("この問題は現在遊べません");

      expect(notice).toBeTruthy();
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(playPath);
      openMenu();
    });

    test("メニューの検証情報から、出題中の問題の式を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      expect(dialog.getByText("BYK+KTK=TKHH")).toBeTruthy();
    });
  });
});
