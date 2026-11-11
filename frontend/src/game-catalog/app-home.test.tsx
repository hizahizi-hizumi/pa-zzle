import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { useGameHome } from "@/game-catalog/game-home";
import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { listNanpurePoolProblemIds } from "@/games/nanpure/problem/problem-pool";
import { selectNanpureProblemById } from "@/games/nanpure/problem-selection";
import type { ProblemIdentity } from "@/games/problem-id";
import { listSlidePuzzlePoolProblemIds } from "@/games/slide-puzzle/problem/problem-pool";
import { selectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import {
  listTsumeShogiPoolSeeds,
  parseTsumeShogiPoolSeed,
} from "@/games/tsume-shogi/problem/problem-pool";
import { _private as appLaunch, startAppLaunch } from "@/lib/app-launch";
import {
  gameSelectionOrderSetting,
  _private as orderPrivate,
} from "@/lib/game-selection-order-setting";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import { writePlayRecords } from "@/records/storage";
import { PuzzleSelectionView } from "@/views/PuzzleSelectionView";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

function selectNanpureIdentity(difficulty: "2" | "4") {
  const problemId = listNanpurePoolProblemIds(difficulty)[0] ?? "";
  const problem = selectNanpureProblemById(difficulty, problemId);
  if (!problem) {
    throw new Error(`No level ${difficulty} Nanpure problem`);
  }
  return problem.identity;
}

function selectSlidePuzzleIdentity(): ProblemIdentity {
  const problemId = listSlidePuzzlePoolProblemIds("1")[0] ?? "";
  const problem = selectSlidePuzzleProblemById("1", problemId);
  if (!problem) {
    throw new Error("No level 1 slide puzzle problem");
  }
  return problem.identity;
}

/** 詰将棋の問題集の本体はゲームの画面で読み込むので、ホームでも引ける索引の seed から identity を作る。 */
function selectTsumeShogiIdentity(): ProblemIdentity {
  const seed = listTsumeShogiPoolSeeds("3")[0];
  if (!seed) {
    throw new Error("No level 3 Tsume Shogi problem");
  }
  return parseTsumeShogiPoolSeed(seed);
}

function saveAbandonedPlay(
  gameId: string,
  startedAt: number,
  difficulty: string,
  problemIdentity: ProblemIdentity,
) {
  startPlayAttempt({
    gameId,
    startedAt,
    start: { difficulty, problemIdentity },
    abandonment: null,
  });
  abandonPlayAttempt(
    { gameId, startedAt },
    { abandonedAt: startedAt + 60_000, progress: { elapsedMs: 60_000 } },
  );
}

type GameHomeProps = {
  game: GameCatalogEntry;
};

function GameHome({ game }: GameHomeProps) {
  const { screenProps } = useGameHome(game);
  return <GameHomeScreen {...screenProps} renderHowToPlayDialog={() => null} />;
}

function renderAtHome() {
  const router = createMemoryRouter([
    { path: "/", element: <PuzzleSelectionView /> },
    {
      path: "/puzzles/nanpure",
      element: <GameHome game={nanpureCatalogEntry} />,
    },
  ]);
  render(<RouterProvider router={router} />);
}

function getHeroLink(): HTMLElement {
  return screen.getByRole("link", { name: /を遊ぶ$/ });
}

function getContinuationText(): string | null {
  const descriptionId = getHeroLink().getAttribute("aria-describedby");
  return descriptionId === null
    ? null
    : (document.getElementById(descriptionId)?.textContent ?? null);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = vi.fn(function ResizeObserver() {
    return { observe() {}, unobserve() {}, disconnect() {} };
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  appLaunch.resetAppLaunch();
  window.localStorage.clear();
  orderPrivate.resetCache();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(window, "ResizeObserver");
});

describe("useAppHome", () => {
  describe("遊んだことが無い場合", () => {
    beforeEach(() => {
      renderAtHome();
    });

    test("並びの先頭のゲームを選んでおき、続きを示さないこと", () => {
      const heroLink = getHeroLink();

      expect(heroLink.getAttribute("aria-label")).toBe(
        "ウォーターソートを遊ぶ",
      );
      expect(getContinuationText()).toBeNull();
    });
  });

  describe("並び順とプレイ履歴が両方ある場合", () => {
    beforeEach(() => {
      gameSelectionOrderSetting.setOrder(["water-sort", "tsume-shogi"]);
      saveAbandonedPlay("nanpure", 100_000, "4", selectNanpureIdentity("4"));
      renderAtHome();
    });

    test("並びの先頭よりも最後に遊んだゲームを選んでおくこと", () => {
      const selected = getHeroLink();

      expect(selected.getAttribute("aria-label")).toBe("ナンプレを遊ぶ");
    });
  });

  describe("ナンプレのあとに、並びの最後の詰将棋を遊んだ場合", () => {
    beforeEach(() => {
      saveAbandonedPlay("nanpure", 100_000, "4", selectNanpureIdentity("4"));
      saveAbandonedPlay(
        "tsume-shogi",
        200_000,
        "3",
        selectTsumeShogiIdentity(),
      );
      renderAtHome();
    });

    test("最後に遊んだ詰将棋を選んでおき、開くレベルと挑戦中の問題の数を続きとして示すこと", () => {
      const heroLink = getHeroLink();

      expect(heroLink.getAttribute("aria-label")).toBe("詰将棋を遊ぶ");
      expect(getContinuationText()).toBe("レベル 3 ・ 挑戦中 1問");
    });
  });

  describe("スライドパズルのあとにナンプレを遊んだ場合", () => {
    beforeEach(() => {
      writePlayRecords([
        createNanpurePlayRecord({
          difficulty: "2",
          problemIdentity: selectNanpureIdentity("2"),
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
      saveAbandonedPlay(
        "slide-puzzle",
        200_000,
        "1",
        selectSlidePuzzleIdentity(),
      );
      saveAbandonedPlay("nanpure", 300_000, "4", selectNanpureIdentity("4"));
      renderAtHome();
    });

    test("最後に遊んだナンプレを選んでおき、開くレベルと挑戦中の問題の数を続きとして示すこと", () => {
      const heroLink = getHeroLink();

      expect(heroLink.getAttribute("aria-label")).toBe("ナンプレを遊ぶ");
      expect(getContinuationText()).toBe("レベル 4 ・ 挑戦中 1問");
    });

    test("ゲームのホームへ入ると、続きと同じレベルを開き、そのレベルの挑戦中の問題の数が続きと一致すること", () => {
      fireEvent.click(getHeroLink());

      const openLevel = screen.getByRole("tab", { selected: true });
      // 状態ごとの数は、狭い画面用と広い画面用の2つを描き、どちらも同じ数を示す。
      const statusCounts = screen.getAllByRole("list", {
        name: "状態ごとの問題の数",
      })[0] as HTMLElement;
      expect(openLevel.textContent).toMatch(/^レベル 4/);
      expect(
        within(statusCounts).getByRole("listitem", { name: "挑戦中 1問" }),
      ).toBeTruthy();
    });

    test("ほかのゲームを選ぶと、そのゲームの続きを示すこと", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "スライドパズルを選択" }),
      );

      expect(getHeroLink().getAttribute("aria-label")).toBe(
        "スライドパズルを遊ぶ",
      );
      expect(getContinuationText()).toBe("レベル 1 ・ 挑戦中 1問");
    });

    test("遊んだことの無いゲームを選ぶと、続きを示さないこと", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "ウォーターソートを選択" }),
      );

      expect(getContinuationText()).toBeNull();
    });

    describe("ゲームを選ぶ前に、ほかのゲームの離脱が保存された場合", () => {
      beforeEach(() => {
        act(() => {
          saveAbandonedPlay(
            "slide-puzzle",
            400_000,
            "1",
            selectSlidePuzzleIdentity(),
          );
        });
      });

      test("そのゲームを最後に遊んだゲームとして選び直すこと", () => {
        const heroLink = getHeroLink();

        expect(heroLink.getAttribute("aria-label")).toBe(
          "スライドパズルを遊ぶ",
        );
      });
    });

    describe("ゲームを選んだあとに、ほかのゲームの離脱が保存された場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "ナンプレを選択" }));
        act(() => {
          saveAbandonedPlay(
            "slide-puzzle",
            400_000,
            "1",
            selectSlidePuzzleIdentity(),
          );
        });
      });

      test("選んだゲームを選んだままにすること", () => {
        const heroLink = getHeroLink();

        expect(heroLink.getAttribute("aria-label")).toBe("ナンプレを遊ぶ");
      });
    });

    describe("ホームをタイトルで覆って開いた場合", () => {
      beforeEach(async () => {
        cleanup();
        await act(async () => {
          startAppLaunch({ showTitle: true, sounds: [] });
        });
        await act(async () => {
          renderAtHome();
        });
      });

      test("タイトルを描いたあとに、最後に遊んだゲームを選んで続きを示すこと", () => {
        const title = screen.getByRole("dialog", { name: "pa-zzle" });
        const heroLink = screen
          .getAllByRole("link", { name: /を遊ぶ$/, hidden: true })
          .find((link) => !title.contains(link));

        expect(heroLink?.getAttribute("aria-label")).toBe("ナンプレを遊ぶ");
      });
    });
  });
});
