import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { difficultyLevels } from "@/games/difficulty";
import {
  createNanpurePlayRecord,
  getNanpurePlayRecordScore,
} from "@/games/nanpure/play-record";
import { listNanpurePoolProblemIds } from "@/games/nanpure/problem/problem-pool";
import { selectNanpureProblemById } from "@/games/nanpure/problem-selection";
import { createProblemId } from "@/games/problem-id";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import { writePlayRecords } from "@/records/storage";
import { GameZukanView } from "@/views/GameZukanView";

function selectPoolProblem(difficulty: "2" | "4", index: number) {
  const problem = selectNanpureProblemById(
    difficulty,
    listNanpurePoolProblemIds(difficulty)[index] ?? "",
  );
  if (!problem) {
    throw new Error(`No level ${difficulty} Nanpure problem`);
  }
  return problem;
}

/** 台紙の先頭のマスになるよう、問題集の先頭の問題を引く。 */
function selectFirstPoolProblem(difficulty: "2" | "4") {
  return selectPoolProblem(difficulty, 0);
}

function countClues(problem: ReturnType<typeof selectPoolProblem>) {
  return problem.problem.clues.filter((cell) => cell !== null).length;
}

const nanpureProblemCount = difficultyLevels.reduce(
  (total, { id }) => total + listNanpurePoolProblemIds(id).length,
  0,
);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = vi.fn(function ResizeObserver() {
    return { observe() {}, unobserve() {}, disconnect() {} };
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(window, "ResizeObserver");
});

function PlayLocation() {
  return <p>プレイ画面</p>;
}

function getSheet(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function chooseLevel(label: string) {
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: new RegExp(`^${label}、`) }),
    { button: 0, ctrlKey: false },
  );
}

function getDetail(): HTMLElement {
  return screen.getByRole("complementary", { name: "選んだ問題" });
}

function renderAt(path: string, { strict = false } = {}) {
  const router = createMemoryRouter(
    [
      { path: "/puzzles/:game/zukan", element: <GameZukanView /> },
      { path: "/puzzles/nanpure/play/:difficulty", element: <PlayLocation /> },
      { path: "/records", element: <p>記録画面</p> },
    ],
    { initialEntries: [path] },
  );
  const app = <RouterProvider router={router} />;
  render(strict ? <StrictMode>{app}</StrictMode> : app);
  return router;
}

const LAST_VIEWED_STORAGE_KEY = "pa-zzle.zukan-last-viewed.v1";

function readStoredLastViewed(): Record<string, Record<string, unknown>> {
  return JSON.parse(
    window.localStorage.getItem(LAST_VIEWED_STORAGE_KEY) ?? "{}",
  );
}

function getChangeSummary(): string | null | undefined {
  return screen.queryAllByText(/新しく解いた|段階が上がった/)[0]?.closest("p")
    ?.textContent;
}

describe("GameZukanView", () => {
  describe("クリアした記録と離脱した試行がある場合", () => {
    const solvedProblem = selectFirstPoolProblem("2");
    const abandonedProblem = selectFirstPoolProblem("4");
    const result = {
      elapsedMs: 120_000,
      mistakeCount: 2,
      undoCount: 0,
      restartCount: 0,
    };
    const records = [
      createNanpurePlayRecord({
        difficulty: "2",
        problemIdentity: solvedProblem.identity,
        startedAt: 1_000,
        completedAt: 121_000,
        result,
      }),
      createNanpurePlayRecord({
        difficulty: "2",
        problemIdentity: solvedProblem.identity,
        startedAt: 200_000,
        completedAt: 260_000,
        result: { ...result, elapsedMs: 60_000, mistakeCount: 0 },
      }),
    ];
    const bestScore = Math.max(
      ...records.map((record) => getNanpurePlayRecordScore(record)),
    );
    let router: ReturnType<typeof renderAt>;

    beforeEach(() => {
      writePlayRecords(records);
      startPlayAttempt({
        gameId: "nanpure",
        startedAt: 300_000,
        start: {
          difficulty: "4",
          problemIdentity: abandonedProblem.identity,
        },
        abandonment: null,
      });
      abandonPlayAttempt(
        { gameId: "nanpure", startedAt: 300_000 },
        { abandonedAt: 360_000, progress: { elapsedMs: 60_000 } },
      );
      router = renderAt("/puzzles/nanpure/zukan");
    });

    test("ゲーム名の図鑑を見出しに出し、解いた問題の数を問題集の全問の数と並べて示すこと", () => {
      const heading = screen.getByRole("heading", { level: 1 });
      const solvedCount = screen.getByText(
        `解いた問題 1 / ${nanpureProblemCount}`,
      );

      expect(heading.textContent).toBe("ナンプレの図鑑");
      expect(solvedCount).toBeTruthy();
    });

    test("最後にクリアまたは離脱したレベルのタブを選んで開くこと", () => {
      const selectedTab = screen.getByRole("tab", { selected: true });

      expect(selectedTab.textContent).toMatch(/^レベル 4、/);
    });

    test("離脱した問題のマスを挑戦中として示すこと", () => {
      const attemptedSquares = within(getSheet("レベル 4の問題")).getAllByRole(
        "button",
        { name: /挑戦中$/ },
      );

      expect(attemptedSquares).toHaveLength(1);
    });

    describe("クリアした問題のマスを選んだ場合", () => {
      beforeEach(() => {
        chooseLevel("レベル 2");
        fireEvent.click(
          within(getSheet("レベル 2の問題")).getByRole("button", {
            name: /最高スコア/,
          }),
        );
      });

      test("ゲームが求めたその問題の特徴に続けて、同じ問題の記録の中で最も良い最高スコア・最速タイム・最少ミスを詳細に示し、ナンプレでは最少手数を示さないこと", () => {
        const facts = within(getDetail())
          .getAllByRole("term")
          .slice(0, -1)
          .map((term) => [term.textContent, term.nextSibling?.textContent]);

        expect(facts).toEqual([
          ["初期数字", `${countClues(solvedProblem)}個`],
          ["最高スコア", `${bestScore}点`],
          ["最速タイム", "01:00"],
          ["最少ミス", "0回"],
        ]);
      });

      test("遊ぶを押すと、その問題の問題 ID を載せたプレイ画面を開くこと", () => {
        fireEvent.click(
          within(getDetail()).getByRole("button", { name: "遊ぶ" }),
        );

        expect(router.state.location.pathname).toBe("/puzzles/nanpure/play/2");
        expect(router.state.location.search).toBe(
          `?problem=${createProblemId(solvedProblem.identity)}`,
        );
      });
    });

    describe("まだ挑んでいない問題のマスを選んだ場合", () => {
      /** 問題集の先頭は離脱した問題なので、最初の未挑戦のマスは2問目になる。 */
      const untouchedProblem = selectPoolProblem("4", 1);

      beforeEach(() => {
        fireEvent.click(
          within(getSheet("レベル 4の問題")).getAllByRole("button", {
            name: /未挑戦$/,
          })[0] as HTMLElement,
        );
      });

      test("ゲームが求めたその問題の特徴を詳細に示すこと", () => {
        const facts = within(getDetail())
          .getAllByRole("term")
          .map((term) => [term.textContent, term.nextSibling?.textContent]);

        expect(facts).toEqual([
          ["初期数字", `${countClues(untouchedProblem)}個`],
        ]);
      });

      test("遊ぶを押すと、その問題を引けるプレイ画面を開くこと", () => {
        fireEvent.click(
          within(getDetail()).getByRole("button", { name: "遊ぶ" }),
        );
        const problemId = new URLSearchParams(router.state.location.search).get(
          "problem",
        );

        expect(router.state.location.pathname).toBe("/puzzles/nanpure/play/4");
        expect(selectNanpureProblemById("4", problemId ?? "")).not.toBeNull();
      });
    });

    test("難易度選択へ戻る導線を出すこと", () => {
      const backLink = screen.getByRole("link", { name: "戻る" });

      expect(backLink.getAttribute("href")).toBe("/puzzles/nanpure");
    });
  });

  describe("前回図鑑を見たときの状態を保存している場合", () => {
    const solvedProblem = selectFirstPoolProblem("2");
    const solvedProblemId = createProblemId(solvedProblem.identity);
    const abandonedProblem = selectFirstPoolProblem("4");
    const abandonedProblemId = createProblemId(abandonedProblem.identity);
    const takuzuLastViewed = { "1": { "takuzu-problem": "perfect" } };

    async function finishReveal() {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
      writePlayRecords([
        createNanpurePlayRecord({
          difficulty: "2",
          problemIdentity: solvedProblem.identity,
          startedAt: 1_000,
          completedAt: 121_000,
          result: {
            elapsedMs: 120_000,
            mistakeCount: 0,
            undoCount: 0,
            restartCount: 0,
          },
        }),
      ]);
      startPlayAttempt({
        gameId: "nanpure",
        startedAt: 300_000,
        start: {
          difficulty: "4",
          problemIdentity: abandonedProblem.identity,
        },
        abandonment: null,
      });
      abandonPlayAttempt(
        { gameId: "nanpure", startedAt: 300_000 },
        { abandonedAt: 360_000, progress: { elapsedMs: 60_000 } },
      );
      window.localStorage.setItem(
        LAST_VIEWED_STORAGE_KEY,
        JSON.stringify({
          nanpure: { "1": {}, "2": {}, "4": {} },
          takuzu: takuzuLastViewed,
        }),
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("開いた場合", () => {
      beforeEach(async () => {
        renderAt("/puzzles/nanpure/zukan");
        await finishReveal();
      });

      test("保存する前に読んだ前回の状態から、変化を示すこと", () => {
        const summary = getChangeSummary();

        expect(summary).toBe("新しく解いた 1問");
      });

      test("変化の無いレベルを今の状態で保存し、まだ見せていない変化のあるレベルは前回の状態のまま残すこと", () => {
        const stored = readStoredLastViewed().nanpure;

        expect(stored?.["4"]).toEqual({ [abandonedProblemId]: "attempted" });
        expect(stored?.["2"]).toEqual({});
      });

      test("ほかのゲームの前回の状態を保つこと", () => {
        const stored = readStoredLastViewed().takuzu;

        expect(stored).toEqual(takuzuLastViewed);
      });
    });

    describe("変化のあるレベルを見せずに閉じて開き直した場合", () => {
      beforeEach(async () => {
        renderAt("/puzzles/nanpure/zukan");
        await finishReveal();
        cleanup();
        renderAt("/puzzles/nanpure/zukan");
      });

      test("そのレベルの変化をもう一度示すこと", () => {
        const summary = getChangeSummary();
        const markedTab = screen.getByRole("tab", {
          name: /^レベル 2、.*前回から変化あり/,
        });

        expect(summary).toBe("新しく解いた 1問");
        expect(markedTab).toBeTruthy();
      });
    });

    describe("変化のあるレベルを開いて見せ終えた場合", () => {
      beforeEach(async () => {
        renderAt("/puzzles/nanpure/zukan");
        await finishReveal();
        chooseLevel("レベル 2");
        await finishReveal();
      });

      test("そのレベルを今の状態で保存すること", () => {
        const stored = readStoredLastViewed().nanpure;

        expect(Object.keys(stored?.["2"] ?? {})).toEqual([solvedProblemId]);
      });

      test("閉じて開き直すと、同じ変化を示さないこと", () => {
        cleanup();
        renderAt("/puzzles/nanpure/zukan");
        const summary = getChangeSummary();

        expect(summary).toBeUndefined();
      });
    });

    describe("StrictMode で開いた場合", () => {
      beforeEach(async () => {
        renderAt("/puzzles/nanpure/zukan", { strict: true });
        await finishReveal();
      });

      test("開いたときに保存した状態ではなく、前回の状態から変化を示すこと", () => {
        const summary = getChangeSummary();

        expect(summary).toBe("新しく解いた 1問");
      });
    });

    describe("前回の状態の無いゲームの図鑑から移ってきた場合", () => {
      beforeEach(async () => {
        const router = renderAt("/puzzles/minesweeper/zukan");
        await finishReveal();
        await act(async () => {
          await router.navigate("/puzzles/nanpure/zukan");
        });
        await finishReveal();
      });

      test("移る前のゲームの前回の状態を使わず、そのゲームの前回の状態から変化を示すこと", () => {
        const heading = screen.getByRole("heading", { level: 1 });
        const summary = getChangeSummary();

        expect(heading.textContent).toBe("ナンプレの図鑑");
        expect(summary).toBe("新しく解いた 1問");
      });

      test("それぞれのゲームの前回の状態を混ぜずに保存すること", () => {
        const stored = readStoredLastViewed();

        expect(Object.keys(stored).sort()).toEqual([
          "minesweeper",
          "nanpure",
          "takuzu",
        ]);
        expect(stored.nanpure?.["2"]).toEqual({});
        expect(stored.takuzu).toEqual(takuzuLastViewed);
      });
    });
  });

  describe("記録が無い場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/nanpure/zukan");
    });

    test("解いた問題が無いことを全問の数と並べて示し、レベル 1 の台紙を1番の空きマスから並べること", () => {
      const solvedCount = screen.getByText(
        `解いた問題 0 / ${nanpureProblemCount}`,
      );
      const firstSquare = within(getSheet("レベル 1の問題")).getAllByRole(
        "button",
      )[0];

      expect(solvedCount).toBeTruthy();
      expect(firstSquare?.getAttribute("aria-label")).toBe(
        "No.0001 レベル 1 未挑戦",
      );
    });
  });

  describe("今のアプリに無いゲームの場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/unknown-game/zukan");
    });

    test("図鑑が見つからないことを示し記録画面への導線を出すこと", () => {
      const heading = screen.getByRole("heading", {
        name: "図鑑が見つかりません",
      });
      const backLink = screen.getByRole("link", { name: "記録へ戻る" });

      expect(heading).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/records");
    });
  });
});
