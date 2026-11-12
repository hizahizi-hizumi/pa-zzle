import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import {
  _private as playBoardReturnPrivate,
  settlePlayBoard,
} from "@/components/play-board-return";
import {
  openProblemPlay,
  useGameNavigation,
} from "@/game-catalog/game-navigation";
import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { useNavigate } from "@/router";

const game = minesweeperCatalogEntry;

function RouterWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/puzzles/minesweeper/play/1"]}>
      {children}
    </MemoryRouter>
  );
}

function useNavigationWithLocation() {
  return {
    navigation: useGameNavigation(game),
    navigate: useNavigate(),
    location: useLocation(),
    navigationType: useNavigationType(),
  };
}

describe("useGameNavigation", () => {
  let result: { current: ReturnType<typeof useNavigationWithLocation> };

  beforeEach(() => {
    ({ result } = renderHook(useNavigationWithLocation, {
      wrapper: RouterWrapper,
    }));
  });

  test("backToHome で / へ移ること", () => {
    act(() => result.current.navigation.backToHome());

    const { pathname } = result.current.location;

    expect(pathname).toBe("/");
  });

  test("openGameHome でゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome());

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper");
    expect(search).toBe("");
  });

  test("openGameHome に問題 ID を渡すと、その問題 ID を URL に載せたゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome("problem-1"));

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper");
    expect(search).toBe("?problem=problem-1");
  });

  test("openGameHome は、履歴に積んでゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome("problem-1"));

    const { navigationType } = result.current;

    expect(navigationType).toBe("PUSH");
  });

  test("openGameHome に replacesHistory を渡すと、今の画面の履歴を置き換えてゲームのホームへ移ること", () => {
    act(() =>
      result.current.navigation.openGameHome("problem-1", {
        replacesHistory: true,
      }),
    );

    const { location, navigationType } = result.current;

    expect(location.search).toBe("?problem=problem-1");
    expect(navigationType).toBe("REPLACE");
  });

  describe("プレイ画面の盤面がある場合", () => {
    let animate: ReturnType<typeof vi.fn>;
    let preview: HTMLElement;

    beforeEach(() => {
      const playFrame = document.createElement("section");
      playFrame.dataset.playFrame = "";
      const playBoard = document.createElement("div");
      playBoard.dataset.playEntryBoard = "";
      playFrame.append(playBoard);
      preview = document.createElement("div");
      const homeBoard = document.createElement("div");
      homeBoard.dataset.playEntryBoard = "";
      const moved = document.createElement("div");
      moved.append(homeBoard);
      preview.append(moved);
      document.body.append(playFrame, preview);
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 100, 100),
      );
      animate = vi.fn(
        () =>
          ({
            finished: new Promise(() => {}),
            cancel: vi.fn(),
          }) as unknown as Animation,
      );
      Element.prototype.animate = animate as unknown as Element["animate"];
    });

    afterEach(() => {
      playBoardReturnPrivate.reset();
      document.body.replaceChildren();
      vi.restoreAllMocks();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    test("openGameHome は、プレイ画面の盤面の位置を控え、移った先のゲームのホームの盤面をそこから収められるようにすること", () => {
      act(() => result.current.navigation.openGameHome("problem-1"));
      settlePlayBoard(preview);

      expect(animate).toHaveBeenCalledTimes(1);
    });
  });

  test("startNewProblem で難易度のプレイ画面を開き、別の問題の ID を URL に載せること", () => {
    act(() => result.current.navigation.startNewProblem("3", "problem-1"));

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper/play/3");
    expect(game.listPoolProblemIds("3")).toContain(
      new URLSearchParams(search).get("problem"),
    );
    expect(result.current.navigationType).toBe("PUSH");
  });

  test("プレイ中の別の問題では履歴を置き換えること", () => {
    act(() =>
      result.current.navigation.startNewProblem("3", "problem-1", {
        replacesHistory: true,
      }),
    );
    expect(result.current.navigationType).toBe("REPLACE");
  });
});

describe("openProblemPlay", () => {
  let result: { current: ReturnType<typeof useNavigationWithLocation> };

  beforeEach(() => {
    ({ result } = renderHook(useNavigationWithLocation, {
      wrapper: RouterWrapper,
    }));
  });

  test("渡した難易度のプレイ画面を、問題 ID を URL に載せて開くこと", () => {
    act(() =>
      openProblemPlay(result.current.navigate, {
        playPath: game.playPath,
        difficulty: "2",
        problemId: "problem-1",
      }),
    );

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper/play/2");
    expect(search).toBe("?problem=problem-1");
  });
});
